# Specification — Matcher Stock Overrides and Custom Current Stock Export

This specification details the technical requirements, database alterations, API contracts, and user interface changes needed to introduce custom stock overrides and default stock fallbacks in the Pharmacy Catalog Matcher application.

---

## 1. Functional Requirements

*   **REQ-001 (Toggle Configuration)**: The Matcher config panel must provide an option to toggle stock usage from the uploaded sheet, similar to the existing "Use Uploaded Prices" configuration.
*   **REQ-002 (Dropdown Mapping)**: When the stock override option is enabled, the interface must display a dropdown listing all sheet column headers.
*   **REQ-003 (Default Value Input)**: The panel must feature an always-editable numeric input field for "Default Stock" (pre-filled with `10`).
*   **REQ-004 (Auto-Detection)**: The system must automatically detect the stock column on upload by matching headers with candidates: `"stock"`, `"qty"`, `"quantity"`, `"الكمية"`, `"الرصيد"`.
*   **REQ-005 (Export Target)**: The custom output schema appended to campaign sheets must contain a column named exactly **`current_stock`**.

---

## 2. Technical Implementation & Data Flow

### 2.1 Database Integration (`backend/tools/matcher_db.py`)
To track campaign attributes:
1.  Initialize database tables with:
    *   `use_uploaded_stock` (`INTEGER DEFAULT 0`)
    *   `stock_column` (`TEXT`)
    *   `default_stock` (`INTEGER DEFAULT 10`)
2.  Adjust `create_job()` and job details retrieval helpers to parse and return these fields.

### 2.2 Endpoint Modification (`backend/api.py`)
Update `/api/matcher/run` to handle stock configurations as FastAPI form fields:
```python
use_uploaded_stock: bool = Form(False)
stock_column: Optional[str] = Form(None)
default_stock: int = Form(10)
```

### 2.3 Row processing (`backend/tools/matcher_runner.py`)
Within `run_matcher_background`:
1.  Verify if `use_uploaded_stock` is active and the designated column exists.
2.  Evaluate each row's quantity:
    *   If present, parse it to an integer (regex `\d+` extraction).
    *   On failure, missing, or empty value, fallback to the job's `default_stock`.
3.  Store the resolved quantity in the `results.json` mapping list as `uploaded_stock`.
4.  Update compilation scripts to supply the resolved stock to the spreadsheet generators.

---

## 3. UI Layout Adjustments

### 3.1 Constants Update (`frontend/constants/columns.ts`)
Add the export column option to `matcherColumnOptions`:
```typescript
{ key: "custom_current_stock", label: "current_stock", group: "custom", defaultChecked: true }
```

### 3.2 Form Configuration Component (`frontend/components/matcher/MatchConfig.tsx`)
Render the controls under the price configurations:
1.  **Toggle**: "Use Uploaded Stock"
2.  **Dropdown**: "Select Stock Column" (visible only when toggle is enabled)
3.  **Numeric Input**: "Default Stock" (always visible, defaults to 10)

### 3.3 Main Coordinator Component (`frontend/components/DrugMatcher.tsx`)
Manage and submit stock configuration states (`useUploadedStock`, `stockColumn`, `defaultStock`), handle auto-detection, and restore parameters when recovering historical campaigns.

### 3.4 Export Dialog (`frontend/components/matcher/ExportDialog.tsx`)
Map the `custom_current_stock` key to populate the final downloadable spreadsheet records under `current_stock`.
