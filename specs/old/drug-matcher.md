# Drug Matcher — Specification

> **File:** `tools/matcher.py`
> **Version:** 1.0
> **Status:** Specification / Pre-implementation

---

## 1. Overview

`matcher.py` is a CLI tool that maps pharmacy product names from input sheets to their canonical records in the reference database (`data-extractor/data/products.json`). It leverages the existing normalizer pipeline to bring both the query and the reference into a shared normalized space, then scores and ranks candidates using a combined similarity metric.

The tool has two operating modes:

| Mode | Trigger | Description |
|------|---------|-------------|
| **Single** | positional argument (a name string) | Match one product name against the reference; print Rich table to console |
| **Sheet** | `--file <path>` | Match every row in an input sheet; write a matched output file + JSON summary |

---

## 2. Reference Database

### 2.1 Source Files

| File | Role |
|------|------|
| `data-extractor/data/products.json` | Raw reference — 27,689 product records |
| `data/sheets_output/products_normalized.json` | Pre-normalized reference — used at match time |

### 2.2 Product Record Structure

Each record in `products_normalized.json` contains:

```json
{
  "id": 203945,
  "parent_id": 203944,
  "sku": "139589",
  "name_en": "Sitz Bath With Pump (For Hemorrhoids)",
  "normalized_name_en": "sitz with pump for bath hemorrhoids",
  "name_ar": "...",
  "price": 440,
  "discount_price": null,
  "in_stock": true,
  "stock": 15,
  "active": true,
  "brand": { "id": 8738, "name": "La Roche Posay", "name_ar": "..." },
  "category": { "id": 1265, "name": "HOME & HOSPITAL HEALTH CARE", ... },
  "product_variants": [
    {
      "id": 203945,
      "name_en": "...",
      "normalized_name_en": "...",
      "sku": "139589",
      "price": 440,
      "in_stock": true,
      "options": [...]
    }
  ],
  "need_prescription": false,
  "share_link": "..."
}
```

### 2.3 Search Field

The matcher **always searches against `normalized_name_en`** — present on both the parent product and each entry in `product_variants`. This is sufficient for Arabic queries too, because the normalizer pipeline translates Arabic tokens into their English equivalents (e.g. `"بانادول 500مجم"` → `"panadol 500 mg"`) before matching.

### 2.4 Variant Matching

The search index is built over **both parent products and their variants**. Each searchable entry is:

```
(normalized_name_en, parent_id, variant_id, variant_sku, variant_price, variant_options)
```

When a variant's `normalized_name_en` differs from its parent's, it is indexed separately. When a match is found, the output reports:
- The **parent product** fields (`id`, `name_en`, `brand`, `category`, etc.)
- The **matched variant** `id`, `sku`, and `price` (if the hit came from a variant)

> **Current dataset note:** As of the current export, every product has exactly one variant (itself). The index is designed to scale to true multi-variant products without code changes.

---

## 3. Scoring Algorithm

### 3.1 Combined Similarity Score

The score between a normalized query `q` and a normalized candidate `c` is:

```
score(q, c) = (jaccard(q, c) × w_j) + (seq_match(q, c) × w_s)
```

Where:
- `jaccard(q, c)` = token-level Jaccard similarity (set intersection / union)
- `seq_match(q, c)` = `difflib.SequenceMatcher` character-level ratio
- `w_j` = Jaccard weight (default: **0.7**)
- `w_s` = SequenceMatcher weight (default: **0.3**)

Weights are configurable via `--jaccard-weight` and `--seq-weight`. They must sum to `1.0`; the tool validates this at startup.

### 3.2 Pre-filter (Speed Optimization)

Before computing full pairwise scores, a **token overlap pre-filter** discards candidates with zero shared tokens with the query. This avoids scoring the entire 27,689-entry index for every row in large sheets.

Pre-filter logic:
```python
query_tokens = set(normalized_query.split())
# Keep only candidates that share at least 1 token with the query
candidates = [c for c in index if query_tokens & set(c.normalized.split())]
# Fall back to full index if pre-filter yields 0 candidates
if not candidates:
    candidates = index
```

### 3.3 Scoring Flow (Full)

```
Raw input
   │
   ▼
normalize(input)          ← normalizer pipeline (arabic + english)
   │
   ▼
Token pre-filter          ← discard zero-overlap candidates
   │
   ▼
score(query, each_candidate)
   │
   ▼
Sort descending → top-K   ← --top N (default: 5)
   │
   ▼
Apply threshold labels    ← matched / review / no_match
```

---

## 4. Confidence Thresholds

Each matched row is assigned a **status label** based on the top-1 candidate score:

| Status | Condition | Default threshold |
|--------|-----------|-------------------|
| `matched` | score ≥ match threshold | **85%** |
| `review` | review threshold ≤ score < match threshold | **50%** |
| `no_match` | score < review threshold | — |

Thresholds are configurable:

```bash
python tools/matcher.py --file sheet.xlsx \
  --match-threshold 90 \
  --review-threshold 60
```

---

## 5. Output Fields

### 5.1 Default Output (no flags)

The following fields from the **top-1 matched product** are appended to each output row:

| Column | Source |
|--------|--------|
| `match_status` | `matched` / `review` / `no_match` |
| `match_score` | float, e.g. `0.923` |
| `matched_id` | product `id` |
| `matched_sku` | matched variant `sku` |
| `matched_name_en` | product `name_en` |
| `matched_name_ar` | product `name_ar` |
| `matched_brand` | `brand.name` (or `null`) |
| `matched_category` | `category.name` |
| `matched_price` | matched variant `price` |
| `matched_in_stock` | matched variant `in_stock` |
| `matched_variant_id` | variant `id` (if matched via variant) |
| `normalized_query` | the normalized form of the input name |

### 5.2 `--full-obj`

Appends the **entire product JSON** as a serialized string in a single `matched_product_json` column.

### 5.3 `--fields <field1,field2,...>`

Selects a custom subset of product fields to append. Example:

```bash
python tools/matcher.py --file sheet.xlsx --fields id,sku,name_en,price,in_stock
```

> `--fields` and `--full-obj` are mutually exclusive.

### 5.4 Top-K Candidate Columns

All top-K candidates (controlled by `--top`, default: `5`) are written as **flat columns** alongside the primary match columns:

```
candidate_1_score   candidate_1_id   candidate_1_sku   candidate_1_name_en   candidate_1_variant_id
candidate_2_score   candidate_2_id   candidate_2_sku   candidate_2_name_en   candidate_2_variant_id
...
candidate_N_score   ...
```

The default output fields (§5.1) always refer to `candidate_1` (the top scorer). Subsequent candidates are provided for human review.

---

## 6. Operating Modes

### 6.1 Single Product Mode

Match one raw product name against the reference and print results to the console.

```bash
python tools/matcher.py "AUGMENTIN 1GM TABS"
python tools/matcher.py "AUGMENTIN 1GM TABS" --top 10
python tools/matcher.py "AUGMENTIN 1GM TABS" --rich
python tools/matcher.py "AUGMENTIN 1GM TABS" --json
python tools/matcher.py "AUGMENTIN 1GM TABS" --json --top 3
```

#### Default display (Rich table — same style as `search.py`)

```
╭─ Query Normalization ───────────────────────────────╮
│ Raw Query:   AUGMENTIN 1GM TABS                     │
│ Normalized:  augmentin 1000 mg tab                  │
╰─────────────────────────────────────────────────────╯

🔍 Top 5 Candidates:
 Score    ID       SKU       Name (EN)                   Brand
 ──────── ──────── ──────── ─────────────────────────── ───────
 94.2%   102311   88812    Augmentin 1 gm 14 Tablets    GSK
 81.0%   102310   88811    Augmentin 625 mg 14 Tablets  GSK
 ...
```

#### `--rich` flag (full breakdown)

Adds a second panel showing:
- Step-by-step normalization breakdown (each pipeline stage and its output)
- All default fields for each candidate: `brand`, `category`, `price`, `in_stock`, `variant_id`

#### `--json` flag (machine-readable stdout)

Outputs a JSON object to stdout:

```json
{
  "query": "AUGMENTIN 1GM TABS",
  "normalized_query": "augmentin 1000 mg tab",
  "candidates": [
    {
      "rank": 1,
      "score": 0.942,
      "status": "matched",
      "id": 102311,
      "sku": "88812",
      "name_en": "Augmentin 1 gm 14 Tablets",
      "name_ar": "...",
      "brand": "GSK",
      "category": "Antibiotics",
      "price": 85.0,
      "in_stock": true,
      "variant_id": 102311
    }
  ]
}
```

> `--rich` and `--json` can be combined: Rich display is sent to `stderr`, JSON to `stdout` — allowing piping while still seeing the pretty output.

---

### 6.2 Sheet Matching Mode

Match every row in an input sheet against the reference.

```bash
# Basic
python tools/matcher.py --file data/sheets_input/sheet-1.xlsx

# Custom output path
python tools/matcher.py --file data/sheets_input/sheet-1.xlsx --output results/sheet-1_matched.xlsx

# Custom column, thresholds, top-K
python tools/matcher.py --file sheet-1.xlsx \
  --column "Drug Name" \
  --top 3 \
  --match-threshold 90 \
  --review-threshold 55

# Custom fields
python tools/matcher.py --file sheet-1.xlsx --fields id,sku,name_en,price

# Full product object
python tools/matcher.py --file sheet-1.xlsx --full-obj

# Enable verbose Rich live progress
python tools/matcher.py --file sheet-1.xlsx --verbose
```

#### Input Column Detection

The name column is auto-detected using the same logic as `normalize.py`:

```python
NAME_COLUMN_CANDIDATES = [
    "name", "Name", "NAME",
    "الاسم", "الاسم الانجليزى", "الاسم العربي",
    "product_name", "Product Name", "item_name", "Item Name",
    "drug_name", "Drug Name",
]
```

Override with `--column <col_name>`.

#### Normalization of Input Sheet

If the sheet already has a `normalized_name` column → use it directly (skip re-normalization).

If it does **not** → the tool fails with:

```
⚠ No 'normalized_name' column found in sheet-1.xlsx.
   The matcher needs normalized names to work correctly.

   Normalize now? This will run the normalizer pipeline on column 'Name'. [y/N]:
```

On approval (`y`), the normalizer runs on-the-fly and the resulting `normalized_name` values are used for matching. The **original file is not modified**.

#### Progress Display (`--verbose`)

By default, sheet matching runs **silently** (no output until done).

With `--verbose`, a **Rich Live display** shows real-time running stats:

```
Matching sheet-1.xlsx (1,240 rows)...

 Processed    Matched   Review   No Match   Avg Score   ETA
 ──────────── ───────── ──────── ────────── ─────────── ──────
  842 / 1240   611       187      44         81.3%       0:00:12
```

#### Output Files

Two files are always produced:

**1. Matched data file** (same format as input — `.xlsx` → `.xlsx`, `.csv` → `.csv`)

- Original sheet columns preserved in their original order
- `normalized_query` column appended
- `match_status`, `match_score`, `matched_*` columns appended (§5.1)
- `candidate_1_*` … `candidate_N_*` columns appended (§5.4)

Default output path: `data/sheets_output/<input_stem>_matched.<ext>`
Override with `--output`.

**2. JSON summary report** (always generated, placed alongside the output file):

`data/sheets_output/<input_stem>_matched_summary.json`

```json
{
  "input_file": "sheet-1.xlsx",
  "output_file": "data/sheets_output/sheet-1_matched.xlsx",
  "timestamp": "2026-05-10T18:00:00",
  "reference": "data/sheets_output/products_normalized.json",
  "total_rows": 1240,
  "matched": 611,
  "review": 187,
  "no_match": 44,
  "skipped": 0,
  "matched_pct": 49.3,
  "review_pct": 15.1,
  "no_match_pct": 3.5,
  "avg_score": 0.813,
  "avg_score_matched_only": 0.921,
  "thresholds": {
    "match": 0.85,
    "review": 0.50
  },
  "scoring_weights": {
    "jaccard": 0.7,
    "seq_match": 0.3
  },
  "top_k": 5
}
```

---

## 7. Normalized Reference Handling

The matcher **requires** `data/sheets_output/products_normalized.json` at startup.

If the file is **missing**, the tool halts with:

```
❌ Normalized reference not found:
     data/sheets_output/products_normalized.json

   This file is generated by normalizing the raw products database.
   Generate it now? This may take a moment. [y/N]:
```

On approval (`y`), the equivalent of the following runs internally:

```bash
python tools/normalize.py --file data-extractor/data/products.json --english-only
```

The normalized file is then saved to `data/sheets_output/products_normalized.json` and the matcher proceeds automatically.

---

## 8. CLI Reference

### Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `query` | positional (str) | Single product name to match (single mode) |
| `--file`, `-f` | str | Input sheet path (sheet mode) |
| `--column`, `-c` | str | Name column override (auto-detected if omitted) |
| `--output`, `-o` | str | Output file path (default: `data/sheets_output/<stem>_matched.<ext>`) |
| `--db` | str | Path to normalized reference JSON (default: `data/sheets_output/products_normalized.json`) |
| `--top` | int | Number of candidates to return per row (default: `5`) |
| `--match-threshold` | float | Min score % for `matched` status (default: `85`) |
| `--review-threshold` | float | Min score % for `review` status (default: `50`) |
| `--jaccard-weight` | float | Jaccard component weight (default: `0.7`) |
| `--seq-weight` | float | SequenceMatcher component weight (default: `0.3`) |
| `--fields` | str | Comma-separated product fields to include in output |
| `--full-obj` | flag | Include full product JSON in output column (mutually exclusive with `--fields`) |
| `--json` | flag | Output results as JSON to stdout — single mode only |
| `--rich` | flag | Show full per-field breakdown — single mode only |
| `--verbose` | flag | Enable Rich live progress display — sheet mode only |

### Validation Rules

- `--jaccard-weight` + `--seq-weight` must equal `1.0`
- `--match-threshold` > `--review-threshold` (both in range `0`–`100`)
- `--top` ≥ `1`
- `--fields` and `--full-obj` are mutually exclusive
- `query` (positional) and `--file` are mutually exclusive

---

## 9. File Layout

```
drug-mapping/
├── tools/
│   ├── matcher.py               ← NEW: this script
│   ├── search.py                (existing single-item search)
│   └── normalize.py             (existing normalizer CLI)
├── data/
│   ├── sheets_input/
│   │   ├── sheet-1.xlsx
│   │   ├── sheet-2.xlsx
│   │   └── sheet-3.xlsx
│   └── sheets_output/
│       ├── products_normalized.json       ← reference index (required)
│       ├── sheet-1_matched.xlsx           ← matched output
│       └── sheet-1_matched_summary.json   ← JSON summary report
└── data-extractor/
    └── data/
        └── products.json                  ← raw reference
```

---

## 10. Example Workflows

### Match a single drug name (default Rich table)

```bash
python tools/matcher.py "AUGMENTIN 1GM TABS"
```

### Match with full breakdown display

```bash
python tools/matcher.py "AUGMENTIN 1GM TABS" --rich
```

### Match with JSON output (pipeable)

```bash
python tools/matcher.py "بانادول 500مجم" --json | jq '.candidates[0]'
```

### Match with both Rich (stderr) and JSON (stdout)

```bash
python tools/matcher.py "AUGMENTIN 1GM TABS" --rich --json
```

### Match an entire sheet (silent)

```bash
python tools/matcher.py --file data/sheets_input/sheet-2.xlsx
```

### Match with live progress and custom thresholds

```bash
python tools/matcher.py --file data/sheets_input/sheet-2.xlsx \
  --match-threshold 90 \
  --review-threshold 60 \
  --top 3 \
  --verbose
```

### Match and include only specific fields

```bash
python tools/matcher.py --file sheet-1.xlsx --fields id,sku,name_en,brand,price
```

### Match and include full product objects

```bash
python tools/matcher.py --file sheet-1.xlsx --full-obj
```

---

## 11. Dependencies

All dependencies are already present in the project:

| Package | Used for |
|---------|----------|
| `pandas` | Reading/writing Excel and CSV sheets |
| `openpyxl` | Excel engine for pandas |
| `difflib` | `SequenceMatcher` character similarity |
| `rich` | Console output, live display, tables, panels |
| `normalizer` | Internal normalizer package (`from normalizer import normalize`) |

---

## 12. Out of Scope (v1.0)

The following are explicitly **not** part of this specification:

- Batch processing multiple sheets in a single command (one sheet per run only)
- A web UI or API wrapper
- Learning / feedback loop (flagging corrections to improve future matches)
- Fuzzy phonetic matching (Soundex, Metaphone)
- Vector / embedding-based semantic search
