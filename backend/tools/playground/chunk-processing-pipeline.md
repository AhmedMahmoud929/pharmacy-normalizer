# Data Chunk Processing Pipeline — Reusable Prompt

Use this prompt to process the next raw data chunk. Replace `{PART_NUMBER}` with the actual part number (e.g., 12, 13, etc.).

---

## Prompt

"Please proceed with the next data chunk. Target file: `data/raw_chunks/all-products-names-part-{PART_NUMBER}.txt` (Update the part number as needed).

Follow these steps strictly:

### 1. Run Scanner
Execute `tools/scanner.py` on this specific chunk to identify the most frequent unmapped Arabic tokens and brands.

**Command:**
```powershell
cd "c:\Users\Alrba\OneDrive\Desktop\drug-mapping"; python -c "import sys; sys.path.insert(0, '.'); from tools.scanner import scan_chunk; results = scan_chunk('data/raw_chunks/all-products-names-part-{PART_NUMBER}.txt'); print(f'Total unique unmapped tokens: {len(results)}'); print('---TOP 200---'); [print(f'{word}: {freq}') for word, freq in results[:200]]"
```

Also fetch remaining tokens (200–400):
```powershell
cd "c:\Users\Alrba\OneDrive\Desktop\drug-mapping"; python -c "import sys; sys.path.insert(0, '.'); from tools.scanner import scan_chunk; results = scan_chunk('data/raw_chunks/all-products-names-part-{PART_NUMBER}.txt'); [print(f'{word}: {freq}') for word, freq in results[200:400]]"
```

Check current DB counts:
```powershell
cd "c:\Users\Alrba\OneDrive\Desktop\drug-mapping"; python -c "import sqlite3; conn = sqlite3.connect('normalizer/mappings/db/mappings.db'); c = conn.cursor(); c.execute('SELECT COUNT(*) FROM brands'); print(f'Brands: {c.fetchone()[0]}'); c.execute('SELECT COUNT(*) FROM tokens'); print(f'Tokens: {c.fetchone()[0]}'); c.execute('SELECT COUNT(*) FROM stop_words'); print(f'Stop words: {c.fetchone()[0]}'); conn.close()"
```

### 2. Analysis — Categorize Results

Read the raw chunk file to understand context:
```
data/raw_chunks/all-products-names-part-{PART_NUMBER}.txt
```

Each line format: `Brand | Description | Size/Quantity`

Categorize unmapped tokens into two groups:

#### A. Brands (arabic_name → canonical_name)
Pharmaceutical brand names appearing as the first field before `|`. These are drug/product names.

**Mapping rules:**
- Use the English/Latin brand name as the canonical name (lowercase, spaces → underscores)
- Include variant spellings as separate entries mapping to the same canonical (e.g., `ميبلين`/`ميبيلين`/`مايبيلين` → `maybelline`)
- Source field: `ai-chunk{PART_NUMBER}`

**Examples from chunk 11:**
| Arabic | Canonical |
|---|---|
| كريستور | crestor |
| ليبيتور | lipitor |
| سنجيولير | singulair |
| ميبلين / ميبيلين / مايبيلين | maybelline |

#### B. Tokens (arabic_name → english_name, token_type)
Non-brand terms: dosage forms, units, medical categories, modifiers, route descriptors.

**Token types:** `form`, `unit`, `modifier`, `category`, `route`

**Examples from chunk 11:**
| Arabic | English | Type |
|---|---|---|
| فيال | vial | form |
| كبسولة | capsule | form |
| ملغ / ملج | mg | unit |
| مكجم | mcg | unit |
| ريتارد | retard | modifier |
| فورت | forte | modifier |
| إكس | xr | modifier |
| حيوي / حيوى | antibiotic | category |
| مسكن | analgesic | category |
| مهبلي | vaginal | route |
| للعين | eye | route |

### 3. Database Update

Write a temporary Python script at `tools/_process_chunk{PART_NUMBER}.py` that:

1. Imports `MappingDBManager` from `normalizer.mappings.manager`
2. Checks existing brands/tokens to avoid duplicates
3. Defines `NEW_BRANDS` as list of `(arabic, canonical)` tuples
4. Defines `NEW_TOKENS` as list of `(arabic, english, token_type)` tuples
5. Uses `db.bulk_insert_brands()` and `db.bulk_insert_tokens()` with source=`ai-chunk{PART_NUMBER}`
6. Prints before/after counts

**Template:**
```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from normalizer.mappings.manager import MappingDBManager

db = MappingDBManager()
existing_brands = set(db.get_brand_map().keys())
existing_tokens = set(db.get_token_map().keys())

NEW_BRANDS = [
    # ("arabic", "canonical"),
]

NEW_TOKENS = [
    # ("arabic", "english", "type"),
]

brand_tuples = []
seen = set()
for arabic, canonical in NEW_BRANDS:
    if arabic not in existing_brands and arabic not in seen:
        brand_tuples.append((arabic, canonical, f"ai-chunk{PART_NUMBER}"))
        seen.add(arabic)

token_tuples = []
seen_tokens = set()
for arabic, english, ttype in NEW_TOKENS:
    if arabic not in existing_tokens and arabic not in seen_tokens:
        token_tuples.append((arabic, english, ttype, f"ai-chunk{PART_NUMBER}"))
        seen_tokens.add(arabic)

if brand_tuples:
    db.bulk_insert_brands(brand_tuples)
    print(f"Inserted {len(brand_tuples)} brands")
if token_tuples:
    db.bulk_insert_tokens(token_tuples)
    print(f"Inserted {len(token_tuples)} tokens")

print(f"Total brands: {len(db.get_brand_map())}")
print(f"Total tokens: {len(db.get_token_map())}")
```

**Run:**
```powershell
cd "c:\Users\Alrba\OneDrive\Desktop\drug-mapping"; python tools/_process_chunk{PART_NUMBER}.py
```

### 4. Export
Sync the SQLite database to the JSON export file:
```powershell
cd "c:\Users\Alrba\OneDrive\Desktop\drug-mapping"; python tools/export_mappings.py
```

Expected output: `Exported X brands, Y tokens, and Z stop words to normalizer/mappings/db/mappings_export.json`

### 5. Clean Up
- Move the processed raw file:
  ```powershell
  Move-Item -Path "data/raw_chunks/all-products-names-part-{PART_NUMBER}.txt" -Destination "data/processed_chunks/all-products-names-part-{PART_NUMBER}_DONE.txt"
  ```
- Delete the temporary processing script: `tools/_process_chunk{PART_NUMBER}.py`

### 6. Report
Provide a summary table with:
- Chunk number and file name
- Scanner result: total unmapped tokens count
- New brands added (count + notable examples)
- New tokens added (count + breakdown by type: form, unit, modifier, category, route)
- Current DB totals (brands, tokens, stop words)
- Confirmation of export and file move

---

## Project Structure Reference

```
drug-mapping/
├── data/
│   ├── raw_chunks/          ← Input: all-products-names-part-NN.txt
│   ├── processed_chunks/    ← Output: all-products-names-part-NN_DONE.txt
│   └── all-products-names.txt
├── normalizer/
│   ├── config.py            ← Loads BRAND_MAP, ARABIC_TO_ENGLISH from DB
│   ├── core/                ← Processing pipeline
│   └── mappings/
│       ├── manager.py       ← MappingDBManager class (bulk_insert_brands/tokens)
│       └── db/
│           ├── mappings.db  ← SQLite database
│           └── mappings_export.json  ← Version-controlled export
└── tools/
    ├── scanner.py           ← Finds unmapped tokens in a chunk
    ├── export_mappings.py   ← Exports DB → JSON
    └── _process_chunkNN.py  ← Temp script (deleted after use)
```

## Key API Reference

### MappingDBManager
```python
from normalizer.mappings.manager import MappingDBManager
db = MappingDBManager()

# Read
db.get_brand_map()    → Dict[str, str]  # arabic → canonical
db.get_token_map()    → Dict[str, str]  # arabic → english
db.get_stop_words()   → List[str]

# Write
db.bulk_insert_brands([(arabic, canonical, source), ...])
db.bulk_insert_tokens([(arabic, english, type, source), ...])
db.bulk_insert_stop_words([(arabic_word, source), ...])

# Single
db.add_brand(arabic, canonical, source)
db.add_token(arabic, english, type, source)
```

### scanner.py
```python
from tools.scanner import scan_chunk
results = scan_chunk("path/to/chunk.txt")  # → List[(word, frequency)] sorted desc
```
