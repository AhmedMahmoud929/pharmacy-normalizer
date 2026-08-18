---
title: Shefaa Crawler API Integration & Background Dashboard
version: 1.0.0
date_created: 2026-05-19
last_updated: 2026-05-19
owner: Ahmed Mahmoud / Pharmacy Normalizer Team
tags: [architecture, design, app, backend, frontend]
---

# Introduction

This specification defines the architecture, interfaces, and user experience patterns required to integrate the existing `shefaa-crawler/main.py` capabilities directly into the existing `backend/tools/api.py` application. 

Instead of converting the crawler into a standalone web server or creating a separate service, all crawler triggers, campaign history, SSE logs, and file downloads will be served directly by the **same unified FastAPI server** hosted in `backend/tools/api.py`. This ensures the application remains an elegant, single-server solution containing the normalizer, search, matcher, and shefaa-crawler operations.

---

## 1. Purpose & Scope

The scope of this integration is divided into three layers, hosted on a single backend server:
1. **Crawler Engine Integration**: Interfacing with the standard console execution hooks of `shefaa-crawler/main.py` from within `backend/tools/api.py` using process isolation (local subprocess execution), avoiding invasive rewrites to the crawler's internal scraping logic.
2. **Unified Backend API (api.py)**: Extending the existing FastAPI server (`backend/tools/api.py`) with REST endpoints for starting, stopping, listing, and querying crawler campaigns, along with Server-Sent Events (SSE) streaming for live log telemetry and scraped item chunks on the same port/host.
3. **Frontend Dashboard (Next.js)**: Constructing an immersive, interactive admin panel in the existing Next.js frontend featuring glassmorphism design aesthetics, reactive visual analytics, live ANSI console streaming, and a high-fidelity catalog explorer for browsing fetched data (rich text details, localized text comparison, brand logos, etc.).

---

## 2. Definitions

- **SSE**: Server-Sent Events, a lightweight push technology over standard HTTP allowing a backend to stream events (chunks, progress, logs) to a frontend in real-time.
- **Subprocess Isolation**: Spawning the crawler script as an OS-level subprocess, allowing complete control over execution life cycles, process termination, resource allocation, and standard stream parsing.
- **Deep Specs Enrichment**: The crawler mode (via `--deep` flag) that fetches detailed specification tables, rich-text product overviews, and full galleries by loading individual product landing pages.
- **Meilisearch Ceiling**: The 1,000 hits restriction imposed by default Meilisearch configurations. The scraper overcomes this through a divide-and-conquer strategy slicing prices (0-100,000 EGP).
- **ANSI Console**: Terminal logs generated with formatting codes (colors, weights, trees) using libraries like Rich.

---

## 3. Requirements, Constraints & Guidelines

### Functional Requirements
- **REQ-001**: The system MUST expose all CLI options of the `shefaa-crawler` via a single unified API endpoint.
- **REQ-002**: The system MUST support parallel execution of crawl jobs in the background (asynchronous mode) or stream-oriented foreground execution.
- **REQ-003**: The backend MUST keep track of job history (parameters, statuses, timestamps, run times, results) and persist this data locally.
- **REQ-004**: The system MUST provide an endpoint to immediately stop/kill any active background crawler process on the server safely.
- **REQ-005**: The backend MUST support chunked streaming of the crawler's stdout/stderr and raw product listings dynamically to the client over an SSE connection.
- **REQ-006**: The system MUST support on-the-fly packaging and downloading of crawler results as:
  - **Excel Sheets**: Columnar spreadsheets containing flattened category, brand, and pricing data.
  - **JSON Databases**: Pure structured JSON objects matching the internal data schemas.
  - **Media Archives**: A compressed `.zip` containing all downloaded product gallery images or brand logos.
- **REQ-007**: The frontend MUST present a live ANSI terminal viewer displaying real-time stdout/stderr of active crawl campaigns with correct terminal colors and progress hierarchies.
- **REQ-008**: The frontend MUST feature a deep detail viewer for crawled catalog assets, showing dual-language comparisons, rich HTML overview rendering safely, and product specifications.

### Technical Constraints & Guidelines
- **CON-001**: Spawning thread pools or long-running python loops inside the main `backend/tools/api.py` FastAPI process is prohibited for heavy crawler operations, to prevent locking the python GIL. Subprocess execution (`sys.executable shefaa-crawler/main.py`) MUST be used for background campaigns, executed locally on the same server machine.
- **CON-002**: Background task state MUST be stored in a SQLite database (e.g. `data/crawler_jobs.db`) to ensure restarts do not wipe campaign execution histories.
- **CON-003**: Frontend component code MUST follow strict React 19 / Next.js 15 App Router design patterns.
- **CON-004**: Rendered rich text (e.g. product `overview` HTML fields) MUST be sanitized on the client side using libraries like `DOMPurify` to prevent Cross-Site Scripting (XSS) vulnerabilities.
- **CON-005**: All media storage routes must respect relative storage paths inside the `backend/data/` workspace to prevent filesystem permission issues.
- **CON-006**: **Single-Server Integration Constraint**: The crawler endpoint logic, SSE streaming generators, and subprocess managers MUST coexist directly inside the existing `backend/tools/api.py` script. The crawler API routes share the exact same FastAPI app instance, port, CORS configurations, and runtime resources as the normalizer, search, and matcher.

---

## 4. Interfaces & Data Contracts

### 4.1 Backend REST & SSE Endpoints

```
                    ┌────────────────────────┐
                    │      NEXT.JS CLIENT    │
                    └───────────┬────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │ (1) POST /run       │ (2) GET /stream     │ (3) POST /stop
          ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   FastAPI Route  │  │   FastAPI Route  │  │   FastAPI Route  │
│  (Trigger Job)   │  │   (SSE Streams)  │  │  (Kill Process)  │
└─────────┬────────┘  └─────────▲────────┘  └─────────┬────────┘
          │                     │                     │
          │ [Spawn Process]     │ [Read Pipes]        │ [Send SIGTERM]
          ▼                     │                     ▼
┌──────────────────────────────────────────────────────────────┐
│                  PYTHON SUBPROCESS (main.py)                 │
└──────────────────────────────────────────────────────────────┘
```

#### 1. Trigger Crawl Campaign
- **Method**: `POST`
- **Path**: `/api/crawler/run`
- **Request Body (JSON)**:
```json
{
  "target": "products",
  "category_href": "all",
  "localize": true,
  "country": "eg",
  "lang": "en",
  "deep": true,
  "download": true,
  "stats_only": false,
  "pages": "all",
  "background": true
}
```
*Field Options*:
- `target`: `"products" | "categories" | "sub-categories" | "brands"`
- `category_href`: Slug/URL path (e.g., `"medications"`, `"skin-care"`) or `"all"`
- `localize`: `true | false` (Consolidates English and Arabic catalogs)
- `country`: `"eg" | "sa" | "ae"`
- `lang`: `"en" | "ar"`
- `deep`: `true | false` (Enriches descriptions, specifications, HTML overviews, image sliders)
- `download`: `true | false` (Downloads physical assets locally)
- `stats_only`: `true | false` (Gathers stats only from meilisearch)
- `pages`: String representation (e.g., `"1"`, `"1-5"`, or `"all"`)
- `background`: `true | false` (Launches in detached subprocess mode)

- **Response (JSON)**:
```json
{
  "job_id": "c1a964f4-5f50-4828-be58-37209772da34",
  "status": "running",
  "pid": 28440,
  "message": "Crawl campaign initiated successfully in the background."
}
```

---

#### 2. Get Campaign History & Statuses
- **Method**: `GET`
- **Path**: `/api/crawler/jobs`
- **Query Parameters**:
  - `limit`: `int` (default: 20)
  - `offset`: `int` (default: 0)
  - `status`: `string` (optional: `"running"`, `"completed"`, `"stopped"`, `"failed"`)
- **Response (JSON)**:
```json
{
  "total": 45,
  "limit": 20,
  "offset": 0,
  "jobs": [
    {
      "job_id": "c1a964f4-5f50-4828-be58-37209772da34",
      "status": "running",
      "pid": 28440,
      "target": "products",
      "params": {
        "category_href": "all",
        "localize": true,
        "country": "eg",
        "deep": true,
        "download": true,
        "pages": "all"
      },
      "progress": {
        "total_categories": 124,
        "processed_categories": 12,
        "products_found": 2840,
        "current_action": "Scraping medications specs"
      },
      "created_at": "2026-05-19T10:34:16.890Z",
      "updated_at": "2026-05-19T10:45:02.112Z"
    }
  ]
}
```

---

#### 3. Terminate a Live Campaign
- **Method**: `POST`
- **Path**: `/api/crawler/jobs/{job_id}/stop`
- **Response (JSON)**:
```json
{
  "job_id": "c1a964f4-5f50-4828-be58-37209772da34",
  "status": "stopped",
  "message": "Process terminated successfully. Cleanups initiated."
}
```

---

#### 4. Live SSE Telemetry Stream
- **Method**: `GET`
- **Path**: `/api/crawler/jobs/{job_id}/stream`
- **Headers**:
  - `Content-Type`: `text/event-stream`
  - `Cache-Control`: `no-cache`
  - `Connection`: `keep-alive`

*SSE Event Formats*:

##### Event `info` (sent on initialization)
```
event: info
data: {"job_id": "c1a964f4", "target": "products", "blueprint": {"localize": true, "deep": true}}
```

##### Event `log` (raw stdout line-by-line streaming)
```
event: log
data: {"timestamp": "2026-05-19T10:35:00.123", "line": "\u001b[32m▶ [1/124] Crawl Session:\u001b[0m \u001b[1mMedications\u001b[0m"}
```
*(Handles ANSI escape color characters inside JSON gracefully)*

##### Event `progress` (aggregated metrics)
```
event: progress
data: {"processed_categories": 12, "total_categories": 124, "products_found": 2840, "price_min": 5.5, "price_max": 1200.0, "price_avg": 110.45}
```

##### Event `item` (scraped data chunks sent immediately)
```
event: item
data: {
  "id": "panadol-extra-500",
  "names": {"en": "Panadol Extra 500mg", "ar": "بنادول اكسترا ٥٠٠ ملج"},
  "price": "35.00",
  "currency": "EGP",
  "featured_image": "https://chefaa.com/public/uploads/products/panadol.png",
  "brand": {"id": "gsk", "names": {"en": "GSK", "ar": "جي اس كي"}, "logo_url": null},
  "category": {"id": "pain-killers", "names": {"en": "Pain Killers", "ar": "مسكنات الألم"}}
}
```

##### Event `complete` (sent on successful execution exit)
```
event: complete
data: {"total_products": 29420, "duration_seconds": 14200, "json_path": "data/crawler/jobs/c1a964f4/results.json"}
```

##### Event `error` (sent if process crashes)
```
event: error
data: {"code": 1, "message": "Failed to resolve connection to chefaa.com domain. Stream severed."}
```

---

#### 5. Download Exported Assets
- **Method**: `GET`
- **Path**: `/api/crawler/jobs/{job_id}/download`
- **Query Parameters**:
  - `format`: `"json" | "excel" | "media"`
- **Response**:
  - For `json`: `application/json` file stream.
  - For `excel`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` binary stream.
  - For `media`: `application/zip` archive containing physical downloaded directory assets (`.png`, `.jpeg`).

---

#### 6. Browse Job Datasets (Data Explorer API)
- **Method**: `GET`
- **Path**: `/api/crawler/jobs/{job_id}/products`
- **Query Parameters**:
  - `limit`: `int` (default: 50)
  - `offset`: `int` (default: 0)
  - `search`: `string` (optional, case-insensitive match on English/Arabic names, active substance, SKU)
  - `category`: `string` (optional, filter by category slug)
  - `brand`: `string` (optional, filter by brand slug)
- **Response (JSON)**:
```json
{
  "total": 29420,
  "limit": 50,
  "offset": 0,
  "products": [
    {
      "id": "panadol-extra-500",
      "names": {"en": "Panadol Extra 500mg", "ar": "بنادول اكسترا ٥٠٠ ملج"},
      "price": "35.00",
      "currency": "EGP",
      "brand": {
        "id": "gsk",
        "name": "GSK"
      },
      "category": {
        "id": "pain-relief",
        "name": "Pain Relief"
      },
      "featured_image": "https://chefaa.com/public/uploads/products/panadol.png",
      "has_deep_specs": true
    }
  ]
}
```

---

#### 7. Read Specific Crawled Product Details
- **Method**: `GET`
- **Path**: `/api/crawler/jobs/{job_id}/products/{product_id}`
- **Response (JSON)**:
```json
{
  "id": "panadol-extra-500",
  "names": {
    "en": "Panadol Extra 500mg",
    "ar": "بنادول اكسترا ٥٠٠ ملج"
  },
  "price": "35.00",
  "currency": "EGP",
  "url": "/eg-en/nowProduct/panadol-extra-500",
  "brand": {
    "id": "gsk",
    "names": {
      "en": "GSK",
      "ar": "جي اس كي"
    },
    "logo_url": "https://chefaa.com/public/uploads/brands/gsk.png"
  },
  "category": {
    "id": "pain-relief",
    "names": {
      "en": "Pain Relief",
      "ar": "مسكنات الألم"
    }
  },
  "subcategory": {
    "id": "headache-treatments",
    "names": {
      "en": "Headache Treatments",
      "ar": "علاج الصداع"
    }
  },
  "description": "Panadol Extra with Optizorb provides fast, effective temporary relief of pain.",
  "overview": {
    "en": "<div id=\"nav-home\"><h3>Optizorb technology details</h3><p>Panadol Extra contains clinically proven active ingredients...</p></div>",
    "ar": "<div id=\"nav-home\"><h3>تفاصيل تكنولوجيا اوبتي زرب</h3><p>بنادول اكسترا يحتوي على مكونات نشطة...</p></div>"
  },
  "specification": {
    "Active Ingredient": "Paracetamol 500mg, Caffeine 65mg",
    "Count": "24 Tablets",
    "Age": "12 Years +"
  },
  "featured_image": "https://chefaa.com/public/uploads/products/panadol.png",
  "images": [
    "https://chefaa.com/public/uploads/products/panadol.png",
    "https://chefaa.com/public/uploads/products/panadol-back.png"
  ]
}
```

---

### 4.2 Database Schema (SQLite: `crawler_jobs.db`)

#### Table: `crawler_jobs`
| Column Name | SQLite DataType | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `job_id` | `TEXT` | `PRIMARY KEY` | Unique campaign string (UUID) |
| `status` | `TEXT` | `NOT NULL` | `"pending"`, `"running"`, `"completed"`, `"stopped"`, `"failed"` |
| `pid` | `INTEGER` | `NULL` | OS system process ID of the subprocess |
| `target` | `TEXT` | `NOT NULL` | Campaign target type (products, categories, etc.) |
| `params` | `TEXT` | `NOT NULL` | JSON serialized string of incoming CLI parameters |
| `progress` | `TEXT` | `NOT NULL` | JSON object storing counters (current, total, prices) |
| `output_path`| `TEXT` | `NULL` | Absolute/relative path to resulting json dataset file |
| `media_zip` | `TEXT` | `NULL` | Path to downloaded image assets archive zip |
| `error_msg` | `TEXT` | `NULL` | Traceback or failure descriptions if crashed |
| `created_at` | `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | campaign trigger timestamp |
| `updated_at` | `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | Last updated metrics progress tick |

---

## 5. Acceptance Criteria

- **AC-001**: Given a user requests category scraping, When the API is called with `"target": "categories"`, Then the background runner launches `main.py` with `--categories --localize` and returns a valid SQLite record indicating "running" status.
- **AC-002**: Given a crawler campaign is running, When a stop REST request is dispatched, Then the backend sends `SIGTERM` followed by `SIGKILL` to the registered OS `pid` and marks the database state as `"stopped"`.
- **AC-003**: Given a running product crawl, When a client connects via `/api/crawler/jobs/{job_id}/stream`, Then standard output is piped asynchronously and pushed to the client using structured Server-Sent Events.
- **AC-004**: Given a completed crawl job database, When the client requests an Excel download, Then a file matching `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` is constructed containing flattened rows of English and Arabic merged fields.
- **AC-005**: Given rich-text `overview` fields inside deep product specs, When rendered on the frontend Explorer screen, Then the HTML content displays inside a sandboxed viewport sanitized via DOMPurify without execution of nested script segments.

---

## 6. Test Automation Strategy

### 6.1 Backend Test Levels & Mocking
- **Unit Tests**: Focus on the argument compiler that translates API parameters to CLI flags (e.g. `assert compile_args({"localize": True}) == ["--localize"]`).
- **Subprocess Mocking**: Use python's unittest mock patch standard library to capture `subprocess.Popen` invocations, ensuring processes are created and closed correctly without making actual network requests to Chefaa.
- **SQLite Database Tests**: Ensure concurrent job creations and updates function correctly without write locks under asynchronous calls.

### 6.2 Frontend Component Verification
- **Log Terminal Parser Tests**: Test parsing logic to ensure ANSI escape codes match styling configurations (e.g. `\u001b[32mText` matches `class="text-green-500"`).
- **Infinite Scrolling Explorer**: Mock catalog endpoints returning paged items, asserting layout boundaries respond properly on scroll.
- **Sanitization Checks**: Assert HTML scripts (such as `<script>alert('xss')</script>`) are scrubbed before injection to the page DOM.

---

## 7. Rationale & Context

### 7.1 Process Isolation via Subprocesses
Exposing a Python scraper via a Web API faces a common concurrency trap: memory leaks and GIL locking. Web-based scrapers written inside asynchronous servers often block the event loop due to intense Beautiful Soup parsing operations. 

By executing `main.py` as an OS subprocess:
- Memory issues are isolated to the subprocess.
- Killing a campaign is incredibly simple and reliable using standard OS signals on the system Process ID (`pid`).
- Multiprocessing overhead is managed naturally by the underlying operating system.

### 7.2 Text/Event-Stream (SSE) for Telemetry
Standard WebSocket configurations require heavy handshake cycles, message queues, and bidirectional event routing. Real-time logging of scraper sessions is strictly **unidirectional** (Server to Client). Server-Sent Events (SSE) provide a lightweight, native, and robust alternative over standard HTTP pipelines, integrating perfectly with Next.js readers and FastAPI's `StreamingResponse`.

### 7.3 Single-Server Coexistence & Integration
Combining the matcher, normalizer, meilisearch catalog search, and background crawler orchestration inside the same single-server application (`backend/tools/api.py`) eliminates execution fragmentation. 

The application remains self-contained, simple to deploy, and requires no heavy multi-service infrastructure (such as Celery/Redis). By housing all routes within the same FastAPI instance, we achieve:
1. **Simplified Client Routing**: The frontend communicates with a single unified backend origin, avoiding complex multi-port or multi-origin CORS configurations.
2. **Unified Data & Context**: The crawler endpoints can easily inspect local caches, Meilisearch configurations, and shared database states without network bridge layers.
3. **Resource Efficiency**: Spawning the crawler script locally as a short-lived subprocess keeps CPU/RAM footprints extremely optimized for a single-node setup.

---

## 8. Dependencies & External Integrations

### 8.1 Backend Libraries
- **FastAPI / Uvicorn**: Underlying high-performance REST framework.
- **Pandas & OpenPyXL**: Employed to parse crawled JSON and construct fast, formatted binary Excel exports.
- **SQLite3 / AioSqlite**: Embedded database for job execution metrics and configurations.

### 8.2 Frontend Packages
- **Ansi-to-HTML**: Parser library utilized to style standard CLI color codes inside Next.js terminal logs.
- **Framer Motion**: Smooth animations, layout transitions, and interactive visual progression indicators.
- **DOMPurify**: Library to neutralize XSS vectors inside scraped description and overview rich HTML sections.
- **Lucide React**: Vector layouts icons system.

---

## 9. Examples & Edge Cases

### 9.1 Subprocess Runner Stream Parser Implementation Concept (Python)

```python
import asyncio
import subprocess
import sys
import json
import logging
from typing import Dict, Any

async def run_crawler_subprocess_stream(job_id: str, compiled_args: list):
    """
    Conceptual worker piping standard output directly to logger / SSE hooks
    """
    cmd = [sys.executable, "shefaa-crawler/main.py"] + compiled_args
    
    # Spawn subprocess capturing stdout and stderr separately
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    # Register PID to database immediately
    await update_job_pid_in_db(job_id, proc.pid)
    
    async def read_stream(stream, log_type):
        while True:
            line = await stream.readline()
            if not line:
                break
            line_decoded = line.decode('utf-8', errors='replace').strip()
            
            # Send live logs directly to the memory queue connected to active SSE handlers
            await enqueue_sse_log(job_id, {"type": log_type, "text": line_decoded})
            
            # Check if line contains JSON structures or Rich telemetry stats
            if "Successfully fetched Page" in line_decoded:
                # Compile a progress event update
                progress_metrics = extract_telemetry_from_line(line_decoded)
                await update_db_job_progress(job_id, progress_metrics)
                await enqueue_sse_progress(job_id, progress_metrics)

    # Gather streams concurrently
    await asyncio.gather(
        read_stream(proc.stdout, "stdout"),
        read_stream(proc.stderr, "stderr")
    )
    
    # Await exit state
    return_code = await proc.wait()
    
    if return_code == 0:
        await finalize_job_success(job_id)
    else:
        await finalize_job_failure(job_id, f"Subprocess exited with code {return_code}")
```

### 9.2 Real-time React Log Terminal Parser Concept

```tsx
import React, { useEffect, useRef, useState } from "react";
import AnsiToHtml from "ansi-to-json"; // Conceptual or standard converter

export function LiveTerminalViewer({ jobId }: { jobId: string }) {
  const [logs, setLogs] = useState<{ text: string; type: string }[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource(`/api/crawler/jobs/${jobId}/stream`);

    eventSource.addEventListener("log", (event) => {
      const data = JSON.parse(event.data);
      setLogs((prev) => [...prev, { text: data.line, type: "log" }]);
    });

    eventSource.addEventListener("complete", () => {
      eventSource.close();
    });

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [jobId]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="font-mono text-xs bg-zinc-950 text-zinc-100 p-4 rounded-lg overflow-y-auto max-h-96 border border-zinc-800 shadow-inner">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2">
        <span className="text-zinc-500">Telemetry Log Pipe</span>
        <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping" />
      </div>
      {logs.map((log, i) => (
        <div key={i} className="leading-5 whitespace-pre-wrap">
          {/* Output styled terminal colors using inner HTML parsing */}
          <span dangerouslySetInnerHTML={{ __html: convertAnsiToHtml(log.text) }} />
        </div>
      ))}
      <div ref={terminalEndRef} />
    </div>
  );
}

function convertAnsiToHtml(text: string): string {
  // Strips ANSI tags or maps to span styles dynamically
  const converter = new AnsiToHtml();
  return converter.toHtml(text);
}
```

---

## 10. Validation Criteria

Compliance with this specification requires validation of all the following criteria:

1. **Subprocess Isolation**: Check that starting a crawl creates a separate OS process with a registered PID, and stopping it kills that exact process tree.
2. **SSE Streaming**: Verify that `/api/crawler/jobs/{job_id}/stream` correctly yields chunk events in standard Server-Sent Events structure under heavy scraping loads without drops.
3. **Data Completeness**: Assert that crawled localized data outputs both English and Arabic variants correctly aligned, including descriptions, specification tables, image arrays, and rich HTML overviews.
4. **ANSI Styling**: Confirm that the frontend live terminal successfully processes color configurations (green, cyan, yellow alerts) generated by the `Rich` console outputs inside `main.py`.
5. **No Placeholders**: Confirm that downloaded product asset grids display real retrieved images in clean local directories (`data/media/products/*.png`).

---

## 11. Related Specifications / Further Reading

- **Shefaa Crawler Source CLI (`shefaa-crawler/main.py`)**: For details on HTML selectors, meilisearch pagination limits, and image downloader logic.
- **Drug Matcher API (`backend/tools/api.py`)**: For details on streaming `StreamingResponse` patterns.
- **FastAPI Subprocess Execution Reference**: [Official asyncio subprocess documentation](https://docs.python.org/3/library/asyncio-subprocess.html)
- **Server-Sent Events Specification**: [MDN Web Docs Server-Sent Events documentation](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
