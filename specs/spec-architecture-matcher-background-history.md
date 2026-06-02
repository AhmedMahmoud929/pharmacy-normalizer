---
title: Matcher History & Background Processing Architecture
version: 1.0
date_created: 2026-06-02
tags: [architecture, process, design, backend, frontend]
---

# Introduction

The **Matcher History & Background Processing** system enhances the real-time drug mapping dashboard by introducing historical persistence, background task scheduling on the server, and full UI state recreation. This architecture allows pharmacists and admin users to upload exceptionally large pharmacy sheets, run the matching process asynchronously (e.g., overnight), monitor the active process in real-time, view past matching sessions, manually override matches, and export finalized data sheets at any point in the future.

---

## 1. Purpose & Scope

### 1.1 Purpose
This specification defines the backend schemas, API contracts, background worker mechanisms, and frontend state synchronization required to support:
1. **Asynchronous Background Processing**: Offloading high-intensity sheet mapping tasks to background worker threads or spawned processes.
2. **Matching Session History**: Storing job metadata in SQLite and detailed row-by-row matching evaluations in flat JSON storage on the server.
3. **State Rehydration**: Loading any historical or active matching session into the premium React dashboard, restoring all interactive tables, filters, comparison panels, and statistic charts to their exact end-of-process state.
4. **Post-Match Overrides**: Allowing pharmacists to manually correct low-confidence matches directly from historical sessions, persisting changes in real-time.
5. **On-Demand Exports**: Linking the multi-stage `ExportWizardModal` directly to historical jobs to extract Excel, JSON, or TSV formats for selected slices or attributes.

### 1.2 Scope
This specification covers the design patterns, data flows, database schemas, and endpoints. The implementation details of specific ML scoring engines or core normalization algorithms remain governed by existing specs (such as `realtime-frontend-matcher.md`).

---

## 2. Definitions

- **Match Session / Job**: A single execution instance of mapping an uploaded sheet against the reference database.
- **Reference Database**: The canonical drug catalog loaded into memory (e.g., `chefaa_products_eg_normalized.json`).
- **SSE (Server-Sent Events)**: One-way real-time push communication mechanism used to stream logs and progress frames to the browser.
- **SQLite Job Store**: Local SQLite database (`matcher_jobs.db`) used to track high-level job metadata, run states, and timestamps.
- **Flat JSON Result Store**: Multi-megabyte structured JSON file per job containing the full matching data and candidate options for every row, stored in `/backend/data/matcher/jobs/{job_id}/results.json`.

---

## 3. Requirements, Constraints & Guidelines

### 3.1 Requirements
- **REQ-001 (Background Execution)**: Users must be able to select "Run in Background" during sheet upload. Spawning the background matcher must immediately return a tracking UUID and allow the user to safely navigate away or close the browser tab.
- **REQ-002 (Real-Time Telemetry & SSE)**: Active foreground or background jobs must stream real-time progress percentages, elapsed/remaining durations, and a live scrolling ticker of matched rows using SSE.
- **REQ-003 (State Recreation)**: The UI for a historical completed job must be functionally identical to the immediate post-upload matcher screen, featuring full virtualized tables, filtering (Matched / Review / No Match), query searches, and the interactive comparison panel.
- **REQ-004 (Persistence Layer)**: Job metadata must be written to an SQLite table (`matcher_jobs`). The full collection of row-by-row matches, including all candidate scores and attributes, must be saved as a high-density `/results.json` within a job-dedicated filesystem folder.
- **REQ-005 (Pharmacist Correction & Manual Overrides)**: Historical runs must support manual match overrides (selecting alternative candidate cards or searching and mapping to reference SKUs). Overrides must write back to the `/results.json` file on the server.
- **REQ-006 (Granular Exports)**: Users must be able to export any historical job at any time using the multi-stage `ExportWizardModal`, applying range slicing, format choices (`xlsx`/`json`/`txt`), and custom attribute selections.

### 3.2 Constraints
- **CON-001 (Memory Overhead)**: When running large sheets (>50,000 rows) concurrently, the system must limit the number of parallel subprocesses or threads to prevent server OOM (Out Of Memory) crashes.
- **CON-002 (Frontend DOM Bottleneck)**: For historical datasets exceeding 5,000 rows, virtual scrolling must be utilized in the React components to maintain 60 FPS rendering speeds.
- **CON-003 (No Database Bloat)**: Storing thousands of detailed matching objects (with top 5 candidates, matching tokens, descriptions, etc.) inside the SQLite database will cause rapid DB degradation. Row details must reside in JSON files in the filesystem, with SQLite keeping only high-level metadata and aggregate counts.

### 3.3 Security & Infrastructure Guidelines
- **SEC-001 (File Sanitization)**: Uploaded files must be scanned for extension validation (`.xlsx`, `.xls`, `.csv`) and saved under safe UUID filenames to prevent path traversal attacks.
- **GUD-001 (User Feedback)**: Always show a clear visual transition (e.g., glassmorphism loading card or progress ring) when fetching a historical session's results from the server.

---

## 4. Interfaces & Data Contracts

```mermaid
graph TD
    A[Client Upload / Config] -->|POST /api/matcher/run| B[FastAPI Endpoint]
    B -->|Create Job Entry| C[(SQLite: matcher_jobs)]
    B -->|Save Original File| D[Storage: /data/matcher/jobs/{job_id}/]
    B -->|Spawn Async Task| E[Background Worker / Subprocess]
    E -->|Execute matcher.py| F[Scoring Engine]
    F -->|Write Row Results| G[Storage: .../results.json]
    F -->|Update Status & Stats| C
    E -->|Push Progress Telemetry| H[SSE /stream Channel]
    H -->|Real-Time Update| I[Client Active Dashboard]
    G -->|Paginated Load| J[Client Historical Viewer]
```

### 4.1 SQLite Metadata Table Schema (`matcher_jobs`)
Stored in `backend/data/extracted/matcher_jobs.db`:

| Column Name | Data Type | Constraints / Details |
| :--- | :--- | :--- |
| `job_id` | TEXT | PRIMARY KEY (UUIDv4) |
| `status` | TEXT | 'pending', 'running', 'completed', 'failed', 'stopped' |
| `pid` | INTEGER | System PID if spawned as a subprocess |
| `filename` | TEXT | Original uploaded filename |
| `total_rows` | INTEGER | Total lines/rows counted in sheet |
| `processed_rows` | INTEGER | Active count of completed matches |
| `matched_count` | INTEGER | Count of automatic matches (score >= match_threshold) |
| `review_count` | INTEGER | Count of manual review items (review_threshold <= score < match_threshold) |
| `no_match_count`| INTEGER | Count of unmatched rows (score < review_threshold) |
| `column_used` | TEXT | Name of Excel column mapped |
| `match_threshold`| REAL | Slider value, default `0.60` |
| `review_threshold`| REAL | Slider value, default `0.40` |
| `output_path` | TEXT | Relative path to finalized Excel output |
| `results_path` | TEXT | Relative path to detailed `/results.json` |
| `error_msg` | TEXT | Stack trace or fail reason if status = 'failed' |
| `created_at` | TEXT | ISO8601 Timestamp |
| `started_at` | TEXT | ISO8601 Timestamp |
| `finished_at` | TEXT | ISO8601 Timestamp |
| `duration` | INTEGER | Total execution runtime in seconds |

### 4.2 Restructured API Endpoints

#### 4.2.1 Submit Sheet for Asynchronous Matching
- **Endpoint**: `POST /api/matcher/run`
- **Content-Type**: `multipart/form-data`
- **Request Parameters**:
  - `file`: UploadFile (CSV, XLS, XLSX)
  - `column`: String (detected automatically if null)
  - `top`: Integer (default `5`)
  - `match_threshold`: Float (default `0.60`)
  - `review_threshold`: Float (default `0.40`)
  - `parallel`: Boolean (default `true`)
  - `workers`: Integer (optional)
  - `background`: Boolean (default `false`) — *If true, returns immediately.*
- **Response Payload (Background Submission)**:
  ```json
  {
    "job_id": "8f87dc4e-9d26-4d0f-ba0a-706d877e8a94",
    "status": "pending",
    "filename": "pharmacy_may_sheet.xlsx",
    "total_rows": 2490,
    "created_at": "2026-06-02T12:00:00Z"
  }
  ```

#### 4.2.2 Fetch Historical Job List
- **Endpoint**: `GET /api/matcher/jobs?limit=20&offset=0&status=completed`
- **Response Payload**:
  ```json
  {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "jobs": [
      {
        "job_id": "8f87dc4e-9d26-4d0f-ba0a-706d877e8a94",
        "status": "completed",
        "filename": "pharmacy_may_sheet.xlsx",
        "total_rows": 2490,
        "processed_rows": 2490,
        "matched_count": 1820,
        "review_count": 510,
        "no_match_count": 160,
        "column_used": "Item Description",
        "created_at": "2026-06-02T12:00:00Z",
        "finished_at": "2026-06-02T12:08:45Z",
        "duration": 525
      }
    ]
  }
  ```

#### 4.2.3 Fetch Detailed Row Matches (Paginated & Searchable)
Used to render the table list on demand without loading a 100MB file into client memory.
- **Endpoint**: `GET /api/matcher/job/{job_id}/results?offset=0&limit=100&status=review&search=panadol`
- **Response Payload**:
  ```json
  {
    "job_id": "8f87dc4e-9d26-4d0f-ba0a-706d877e8a94",
    "total_matching_records": 12,
    "limit": 100,
    "offset": 0,
    "results": [
      {
        "row_index": 142,
        "original_name": "PANADOL COLD AND FLU TABS",
        "normalized_name": "panadol cold flu tablets",
        "user_overrode": true,
        "overridden_sku": "sku-pnd-cf-24",
        "overridden_name": "Panadol Cold+Flu 24 Coated Tablets",
        "matches": [
          {
            "score": 0.892,
            "status": "matched",
            "id": "prod-1002",
            "sku": "sku-pnd-cf-24",
            "name_en": "Panadol Cold+Flu 24 Coated Tablets",
            "price": 45.0,
            "db_normalized": "panadol cold flu 24 coated tablets",
            "jaccard": 0.91,
            "sequence": 0.85,
            "matched_tokens": ["panadol", "cold", "flu"],
            "unmatched_query_tokens": ["tabs"],
            "unmatched_db_tokens": ["24", "coated", "tablets"]
          },
          {
            "score": 0.521,
            "status": "review",
            "id": "prod-1005",
            "sku": "sku-pnd-extra-12",
            "name_en": "Panadol Extra 12 Tablets",
            "price": 30.0,
            "db_normalized": "panadol extra 12 tablets",
            "jaccard": 0.45,
            "sequence": 0.61,
            "matched_tokens": ["panadol"],
            "unmatched_query_tokens": ["cold", "flu", "tabs"],
            "unmatched_db_tokens": ["extra", "12"]
          }
        ]
      }
    ]
  }
  ```

#### 4.2.4 Submit Manual Override Match
- **Endpoint**: `POST /api/matcher/job/{job_id}/override`
- **Request Payload**:
  ```json
  {
    "row_index": 142,
    "matched_sku": "sku-pnd-cf-24",
    "product_id": "prod-1002",
    "user_comment": "Verified packaging match by pharmacist."
  }
  ```
- **Action**: Updates the `/results.json` file for the specific `row_index`. Recomputes aggregate stats (`matched_count`, `review_count`, `no_match_count`) in the SQLite database row.

#### 4.2.5 Real-Time Telemetry Progress Stream
- **Endpoint**: `GET /api/matcher/job/{job_id}/stream`
- **Response Headers**: `Content-Type: text/event-stream`
- **Server Events**:
  - `event: progress` — returns JSON status updates:
    ```json
    {
      "processed_rows": 1240,
      "total_rows": 2490,
      "matched_count": 890,
      "review_count": 250,
      "no_match_count": 100,
      "current_action": "Processing batch 13/25..."
    }
    ```
  - `event: result` — streams the latest parsed row matches to feed the live scrolling ticker on active browser windows.
  - `event: complete` — fires when subprocess terminates with exit code 0.

---

## 5. Acceptance Criteria

- **AC-001**: Given a 10,000-row Excel sheet, When a pharmacist uploads the sheet and clicks "Match in Background", Then the server must immediately return a tracking UUID, write a `pending` status to `matcher_jobs.db`, and start executing the scoring pipeline without holding the HTTP response.
- **AC-002**: Given a running background match job, When a user refreshes the matching page or navigates to it via a history list, Then the client must load the current execution percentage, elapsed duration, and display live updates pushed via the SSE `/stream` channel.
- **AC-003**: Given a finished background job from the previous night, When the pharmacist clicks "View Details" from the Matcher History dashboard, Then the table component must render all rows in their exact finished state, including status pills (`Matched`, `Review`, `No Match`) and full support for virtualized scrolling.
- **AC-004**: Given a pharmacist viewing historical matching entries, When they select a row marked as `Review`, choose candidate card #2 in the Comparison Panel, and click "Confirm Match", Then the server must update `/results.json` dynamically and update the job summary totals in `matcher_jobs.db`.
- **AC-005**: Given a historical sheet with manual overrides, When the user clicks the "Export" button, Then they must see the `ExportWizardModal` allowing them to format the finalized spreadsheet (Excel, JSON, TSV) containing the custom column layouts and selected row scopes.

---

## 6. Test Automation Strategy

### 6.1 Unit & Integration Testing
- **Framework**: `pytest` and `httpx.AsyncClient`
- **Endpoint Coverage**:
  - Verify `POST /api/matcher/run` spawns asynchronous threads/processes correctly.
  - Mock file uploads of Excel sheets and ensure metadata indexes correctly in the SQLite table.
  - Validate that paginated requests to `GET /api/matcher/job/{job_id}/results` slice the flat `/results.json` records correctly without loading the full dataset.

### 6.2 Frontend E2E Testing
- **Framework**: Playwright / Cypress
- **Simulations**:
  1. Trigger an upload, toggle "Run in Background", close the active routing, navigate to the history page, and verify the job shows up in the grid as `running`.
  2. Verify virtual list scrolling performs under 16ms per frame on datasets of 5,000 mocked items.

### 6.3 Performance Testing
- **Simulated Load**: Trigger 5 concurrent background matching sessions of a 20,000-row Excel sheet on a server limited to 4 CPU cores.
- **Threshold**: The FastAPI event loop response times must remain under 100ms for health checks (`/health`) while background workers run.

---

## 7. Rationale & Context

### Why utilize flat JSON files instead of relational database rows for detailed matches?
A pharmacy spreadsheet mapping contains complex metadata per row (e.g., top 5 matching candidates, localized image statuses, exact token overlap sets, scores, prices). 
If 10 users match a 10,000-row sheet every week:
- In a pure SQL model: We write $10 \times 10,000 \times 5 \text{ (candidates)} = 500,000$ database rows weekly. This triggers intense SQLite locking issues, slows down index fetches, and balloons the database size, degrading the entire system.
- In the proposed hybrid architecture: The SQLite database acts purely as a fast lookup index for metadata (jobs list, summary metrics). The heavy, structured payloads reside in raw `.json` files mapped under `/backend/data/matcher/jobs/{job_id}/results.json`. Reading, editing, or querying specific lines of a flat file can be done instantly in Python and keeps database writes extremely minimal.

### Spawning `matcher.py` as a Subprocess
The project already features a robust subprocess runner logic for the `shefaa-crawler` (see `backend/api.py`). It captures subprocess outputs in real-time, broadcasts them through SSE, and tracks Unix PIDs in SQLite. Reusing this exact subprocess architecture for the `matcher.py` CLI is a natural choice: it keeps task execution fully isolated from the main FastAPI server process, preventing server hangs due to Python's Global Interpreter Lock (GIL) during heavy matching computations.

---

## 8. Dependencies & External Integrations

### 8.1 Internal Software Modules
- **`backend/tools/matcher.py`**: The core scoring engine. Requires CLI parameter expansion to output raw results JSON alongside the formatted spreadsheet.
- **`backend/normalizer`**: The text-cleaning pipeline, executed on input queries before searching the index.

### 8.2 Third-Party Libraries
- **`pandas` & `openpyxl`**: To parse uploaded worksheets and generate finalized downstream exports.
- **`asyncio`**: Used to execute non-blocking read loops on background worker subprocess streams.

---

## 9. Examples & Edge Cases

### 9.1 Schema representation of `results.json`
Located at `backend/data/matcher/jobs/{job_id}/results.json`:
```json
[
  {
    "row_index": 0,
    "original_name": "CONCOR 5MG TABS",
    "normalized_name": "concor 5mg tablets",
    "user_overrode": false,
    "overridden_sku": null,
    "overridden_name": null,
    "matches": [
      {
        "score": 0.985,
        "status": "matched",
        "id": "prod-4993",
        "sku": "sku-cnc-5",
        "name_en": "Concor 5mg 30 Tablets",
        "price": 40.5,
        "db_normalized": "concor 5mg 30 tablets"
      }
    ]
  }
]
```

### 9.2 Paginated File Parser (Python FastAPI Example)
This utility reads a slice of the JSON results array without loading the full file into memory at once, protecting the server against excessive memory consumption.

```python
import json
import ijson # Iterative JSON parser for large datasets

def get_paginated_job_results(file_path: str, offset: int, limit: int, status_filter: str = None, search_query: str = None):
    records = []
    current_count = 0
    skipped_count = 0
    
    with open(file_path, "r", encoding="utf-8") as f:
        # Stream individual objects out of the JSON array iteratively
        parser = ijson.items(f, 'item')
        for item in parser:
            # Apply search criteria
            if search_query and search_query.lower() not in item["original_name"].lower():
                continue
            
            # Apply status filter mapping based on top candidate
            top_match_status = item["matches"][0]["status"] if item["matches"] else "no_match"
            if status_filter and top_match_status != status_filter:
                continue
                
            # Paginate
            if skipped_count < offset:
                skipped_count += 1
                continue
                
            records.append(item)
            current_count += 1
            if current_count >= limit:
                break
                
    return records
```

---

## 10. Validation Criteria

To consider this specification successfully integrated, the final solution must pass:
1. **Concurrency Validation**: Triggering 3 simultaneous matcher uploads of 10k rows must maintain UI responsiveness, keeping the HTTP health check endpoint response times below 150ms.
2. **Reload Integrity Check**: Matching a file, closing the browser, restarting the server, opening the history tab, selecting the job, and manually overriding a row. The export downloaded after these steps must successfully output the overridden candidate value.

---

## 11. Related Specifications / Further Reading

- [realtime-frontend-matcher.md](file:///a:/drug-mapping/specs/realtime-frontend-matcher.md) — Frontend layout and streaming architecture.
- [drug-matcher.md](file:///a:/drug-mapping/specs/drug-matcher.md) — Base matcher CLI scoring details.
- [spec-architecture-shefaa-crawler-api.md](file:///a:/drug-mapping/specs/spec-architecture-shefaa-crawler-api.md) — Subprocess execution templates and background logger mechanisms.
