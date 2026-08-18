# Specification: Frontend & API Enhancements (Turbo v8)

This document outlines the technical requirements for exposing the new high-performance matching capabilities to the web interface and enhancing the user experience for result analysis.

## 1. API Enhancements (`backend/tools/api.py`)

### 1.1 Parallel Processing Support
The `/match/sheet` endpoint currently processes rows sequentially. It must be updated to support the parallel processing logic introduced in `matcher.py`.

*   **New Parameters:**
    *   `parallel` (bool, default=False): Enable multi-core processing.
    *   `workers` (int, default=None): Number of process workers to spawn.
*   **Implementation:**
    *   Integrate `concurrent.futures.ProcessPoolExecutor` with the `StreamingResponse`.
    *   Use the `initializer=init_worker` pattern from `matcher.py` to ensure each process has a warm `ProductIndex`.
    *   Ensure results are yielded in order or with their original `row_index`.

### 1.2 Enhanced Diagnostic Data
The API already sends back diagnostic tokens (`unmatched_query_tokens`, `unmatched_db_tokens`). We should ensure these are consistently formatted and include brand/category details for the split-screen view.

---

## 2. Frontend Enhancements (`frontend/`)

### 2.1 Configuration Panel
Add a "Performance Settings" section to the sheet upload page.
*   **Worker Control:** A slider or numeric input to set the number of parallel workers.
*   **Threshold Toggles:** UI controls for `match_threshold` and `review_threshold`.

### 2.2 Result Table Expansion
The current table should be made more "dense" and data-rich.
*   **New Columns:**
    *   `Match Status` (Color-coded chips: Green/Yellow/Red).
    *   `Score` (Progress bar or percentage).
    *   `Database Name` (English name of the matched product).
    *   `Brand` (if available).
    *   `Action` (A "Details" button).

### 2.3 Split-Screen Comparison Dialog
When a user clicks "Details" on a row, a modal dialog should open to allow deep analysis.

*   **Layout:** A side-by-side (2-column) split screen.
*   **Left Side (Input):**
    *   Original Name (Raw).
    *   Normalized Name.
    *   Query Tokens (Highlighting matched vs unmatched).
*   **Right Side (Match):**
    *   Matched Product Name.
    *   SKU / ID.
    *   Price / Stock Status.
    *   Database Tokens (Highlighting matched vs unmatched).
*   **Visual Aid:** Use red/green highlighting to show exactly which words failed to match (e.g., specific Arabic terms or unit mismatches).

---

## 3. Technical Goals
1.  **Speed:** Leveraging parallel cores via the frontend to process 10,000+ rows in seconds.
2.  **Transparency:** Giving users the tools to understand *why* a product didn't match (missing mapping vs low score).
3.  **Accuracy:** Making it easier to verify "Review" status items through the comparison dialog.
