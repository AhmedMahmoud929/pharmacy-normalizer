---
title: Decoupling Workspace Architecture and Backend Consolidation Restructuring
version: 1.0
date_created: 2026-05-26
owner: Engineering Team
tags: [architecture, infrastructure, process, refactoring]
---

# Introduction

This specification describes the architectural blueprint and refactoring plan to consolidate the drug mapping workspace into a highly clean, modular, and maintainable **three-folder layout** (`frontend`, `backend`, and `specs`). 

By streamlining all codebase entities, this restructuring merges separate top-level utility folders (such as `shefaa-crawler`, `data`, and `data-extractor`) directly into a unified `backend` package with structured subdivisions, bringing backend API and CLI scripts together under a standard execution context.

---

## 1. Purpose & Scope

### 1.1 Purpose
The purpose of this refactoring is to:
1. **Reduce Project Cognitive Load**: Restructure the workspace to keep only three high-level folders (`frontend`, `backend`, `specs`) to conform to modern software design patterns.
2. **Consolidate Backend Artifacts**: Bring all backend data operations, crawlers, normalization modules, matching scripts, and API routes together under a single cohesive root (`backend/`).
3. **Clean Up Path Configurations**: Eliminate complex and brittle double-dot (`../../`) absolute path configurations across disparate repositories by unifying file resolution contexts.

### 1.2 Scope
- **Root Workspace Folder**: Deleting, renaming, and moving existing top-level directories (`data`, `shefaa-crawler`, `spec`) into their unified final locations.
- **Backend Directory Internal Reorganization**: Establishing `backend/data`, `backend/normalizer`, `backend/tools`, and placing `api.py` directly at the root of `backend/`.
- **System and Import Path Rewrites**: Updating Python relative paths and internal package imports.

---

## 2. Definitions

- **Root Folders**: The primary directories in the workspace root, which will be consolidated to:
  - `frontend/`: The Next.js client application.
  - `backend/`: The FastAPI server, normalizer libraries, crawler scripts, and datasets.
  - `specs/`: Consolidates all design and architecture markdown specifications (formerly `/spec`).
- **Backend Subdirectories**:
  - `backend/data/`: Houses input sheets, media, and raw scraped databases.
  - `backend/normalizer/`: Houses core text normalization and equivalence rules.
  - `backend/tools/`: Houses matching logic, indexing code, and the crawler utilities.
  - `backend/api.py`: FastAPI server router entrypoint.

---

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: **Consolidated Root Folders**: The root directory must contain exactly three primary subfolders: `frontend/`, `backend/`, and `specs/` (renamed from `spec/`). All other top-level folders must be deleted or moved.
- **REQ-002**: **Backend Data Segmentation**: The `backend/data/` directory must partition datasets into three clear folders:
  - `backend/data/input_sheets/` (contains original excel/csv spreadsheets to match).
  - `backend/data/media/` (contains scraped imagery, product downloads, and zip assets).
  - `backend/data/extracted_data/` (contains crawler product JSONs, extracted brand list JSONs, and categories).
- **REQ-003**: **Crawler Script Consolidation**: The existing standalone `shefaa-crawler/` scripts must be moved to `backend/tools/shefaa-crawler/`.
- **REQ-004**: **API Entrypoint Relocation**: The FastAPI web service script `backend/tools/api.py` must be moved to the root level `backend/api.py`.
- **REQ-005**: **Path Resolution Adjustments**: All relative file references in the codebase (e.g. data loader paths, output logs, SQLite database files) must resolve relative to the new unified path standard under the `backend` environment.
- **REQ-006**: **Import Namespace Preservation**: Python imports (e.g. `from normalizer import normalize`, `from tools.matcher import ProductIndex`) must be refactored to resolve naturally from the `backend/` execution path, removing manual `sys.path.append(project_root)` workarounds where possible.

### Constraints
- **CON-001**: **Zero Frontend Disruptions**: The frontend application must not be altered, and its network queries to backend endpoints (such as `/db/products`, `/match`, etc.) must remain unchanged.
- **CON-002**: **No Data Loss**: Active crawled assets, logs, sqlite databases, and matched configurations must be safely moved without data corruption or loss.

---

## 4. Interfaces & Data Contracts

### 4.1 Target Workspace Layout Tree
Below is the structural layout contract for the restructured workspace:

```text
a:\drug-mapping\
├── frontend\                      # Unchanged Next.js client app
│   ├── app\
│   └── components\
├── specs\                         # Consolidated architecture specs (formerly /spec)
│   ├── spec-architecture-crawler-disable-browse-db.md
│   └── spec-architecture-project-restructuring.md
└── backend\                       # Consolidated backend service root
    ├── api.py                     # Web API Server entrypoint (moved from backend/tools/api.py)
    ├── data\
    │   ├── input_sheets\          # Formerly backend/data/sheets_input/
    │   ├── media\                 # Formerly shefaa-crawler/data/media/
    │   └── extracted_data\        # Formerly data/ (chefaa_products_eg.json, etc.)
    │       ├── chefaa_products_eg.json
    │       ├── crawler_jobs.db
    │       └── nested_categories.json
    ├── normalizer\                # Core normalization pipelines & modules
    │   ├── __init__.py
    │   └── core\
    └── tools\                     # Matching engines and crawler controllers
        ├── matcher.py             # Fuzzy matching engine
        ├── shefaa-crawler\        # Scraper engine (formerly shefaa-crawler/)
        │   ├── main.py
        │   └── scan_indexes.py
        └── crawler_db.py          # SQLite crawler log manager
```

---

## 5. Acceptance Criteria

- **AC-001**: Given the workspace root is listed, Then exactly three folders are returned: `frontend`, `backend`, and `specs` along with git configuration files.
- **AC-002**: Given `backend/api.py` is run from the `backend` directory, When FastAPI triggers its startup event, Then it successfully loads the in-memory database index directly from `backend/data/extracted_data/chefaa_products_eg.json`.
- **AC-003**: Given a Python environment launched within the `backend` folder, When executing `import tools` or `from normalizer import normalize`, Then Python resolves the namespaces cleanly without throwing an `ImportError`.
- **AC-004**: Given a crawl operation is triggered from the API, When the shefaa-crawler process executes, Then the crawler outputs are directed to `backend/data/extracted_data/` and downloaded images are directed to `backend/data/media/`.

---

## 6. Test Automation Strategy

### Import and Execution Tests
- **Module Import Validation**: A testing validation script should attempt importing all core packages (`normalizer`, `tools.matcher`, `tools.crawler_db`) inside the `backend` environment and verify error-free imports.
- **File System Verification**: Verify programmatic fileexistence tests to ensure all necessary datasets (`chefaa_products_eg.json`, `nested_categories.json`) are found in their restructured targets.
- **Mock Crawl Path Tests**: Test the CLI command compilation parameters in `backend/api.py` to make sure `--output` flags direct outputs to `backend/data/extracted_data/` instead of legacy paths.

---

## 7. Rationale & Context

### 7.1 Grouping under `backend`
Placing all logic (Normalizer pipelines, Matcher engines, and Crawler scripts) inside the same `backend/` folder resolves Python's path-resolution confusion, making it highly standard. It allows developers to run standard IDE test runners and linters at the sub-package level without needing complex multi-workspace syspath workarounds.

### 7.2 Clear Data Separation
Separating inputs (`input_sheets`), transient/media assets (`media`), and compiled product databases (`extracted_data`) avoids directory pollution, which previously mixed raw user input sheets and system databases together under `backend/data/`.

---

## 8. Dependencies & External Integrations

### Architectural Dependencies
- **DEP-001**: **Shell and CI/CD Scripts**: Any build/run command in shell wrappers (e.g. `redeploy.sh`) must be updated to target `backend/api.py` instead of `backend/tools/api.py`.
- **DEP-002**: **Environment Paths**: Any hardcoded path configurations in scripts must be updated to resolve relative to `backend/` as the current working directory.

---

## 9. Examples & Edge Cases

### 9.1 Path Definition Mapping (Before vs. After)

#### In `backend/tools/matcher.py` (Before):
```python
DEFAULT_DB_PATH = os.path.join(project_root, "data", "sheets_output", "products_normalized.json")
RAW_DB_PATH = os.path.join(project_root, "data-extractor", "data", "products.json")
```

#### In `backend/tools/matcher.py` (After):
```python
# project_root is consolidated to be the backend/ directory
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULT_DB_PATH = os.path.join(backend_root, "data", "extracted_data", "chefaa_products_eg.json")
RAW_DB_PATH = os.path.join(backend_root, "data", "extracted_data", "chefaa_products_eg.json")
```

### 9.2 Relocated Crawler Process Spawning

#### In `backend/api.py` (After restructuring `shefaa-crawler` inside `backend/tools/`):
```python
async def run_crawler_subprocess(job_id: str, cmd_args: List[str], output_path: str, download_media: bool, root_path: str):
    # Relocated path of shefaa-crawler
    crawler_dir = os.path.join(root_path, "tools", "shefaa-crawler")
    cmd = [sys.executable, "-u", os.path.join(crawler_dir, "main.py")] + cmd_args
    
    # Spawn subprocess naturally
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=crawler_dir
    )
```

---

## 10. Validation Criteria

### 10.1 File Path Check
1. Execute file tree analysis in the workspace.
2. Confirm files under `data/` were moved to `backend/data/extracted_data/`.
3. Confirm folders `shefaa-crawler/` were moved to `backend/tools/shefaa-crawler/`.
4. Confirm `spec/` was renamed to `specs/`.

### 10.2 API Service Verification
1. Run `python api.py` from within the `backend/` directory.
2. Verify startup initialization completes successfully, logging successful loading of `chefaa_products_eg.json`.
3. Request `/db/summary`, `/db/products`, `/db/brands`, `/db/categories`, and `/match` via curl or postman and verify exact compatibility of the output payloads.

---

## 11. Related Specifications / Further Reading

- [FastAPI Directory Layout Best Practices](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [Python Package Absolute and Relative Imports](https://docs.python.org/3/reference/import.html)
