# Enhance Normalizer & Matcher — v2 Specification

**Based on analysis of:** `drug_matcher_analysis_2026-05-11T21-07-36.csv`  
**Scope:** 100 items · 28 Matched · 50 Review · 22 No Match  
**Previous:** v1 implemented fixes for gm→mg bug, abbreviation mappings, scoring weights, combo dose splitting, Arabic vocab expansion, and junk detection.

---

## Executive Summary

The v1 fixes were applied to the normalizer code but **the CSV was generated before the backend server was restarted**, meaning the v1 fixes were NOT active during this test run. This explains why many v1 issues (like `60000 mg`) persist in the CSV. However, local testing confirms the v1 code changes ARE correct.

Beyond the stale-server issue, this analysis reveals **three critical architectural gaps** that v1 did not address:

1. **Stale Reference Database** — The `products_normalized.json` was built with the OLD pipeline and contains inconsistencies (`ampoules` vs `injectable`, `sachets` vs `sachet`, `suppositories` not collapsed). It must be regenerated.
2. **`ampoules` still in DB** — Even after v1, the DB reference file has 362 entries with `ampoules` (not `injectable`) because `Ampoules` (capital A, plural) wasn't caught at DB normalization time. The v1 regex fix NOW handles this, but the DB file is stale.
3. **Systematic query-side noise** — `x10P`, `18P`, `5%percent`, `sac.`, `syp.`, `h.shampoo` patterns create junk tokens that aren't cleaned up.

---

## Category 1 — Stale Reference Database (Root Cause of ~15 items)

**Severity:** 🔴 Critical — All other fixes are partially nullified until this is resolved.

### What's Happening

The reference database (`data/sheets_output/products_normalized.json`) was generated using the OLD normalization pipeline (before v1 fixes). As a result, the DB normalized names contain tokens that don't match the query-side normalization:

| DB normalized form | Query normalized form | Items affected |
|--------------------|----------------------|----------------|
| `ampoules` (362 entries) | `injectable` | Rows 33, 34, 36 |
| `sachets` (506 entries) | `sachet` | Rows 17, 42, 58 |
| `suppositories` (64 entries) | `supp` | Rows 13, 48 |
| `film coated` (many entries) | `film coated` | Rows 37, 53, 59 |

The DB currently has:
- `ampoules`: 362 entries, `injectable`: 679 entries — **mixed** (should all be one form)
- `sachets`: 506 entries, `sachet`: 31 entries — **mixed**
- `suppositories`: 64 entries, `supp`: 234 entries — **mixed**

### Fix Specification

**Regenerate the reference database** by re-running the normalization pipeline on `products.json`:

```bash
python tools/normalize.py --english-only --file data-extractor/data/products.json --output data/sheets_output/products_normalized.json
```

This single action will fix all form-token inconsistencies in the DB, since the code-side v1 fixes are already in place. After regeneration, ALL ampoule entries will be `injectable`, all sachet entries will be `sachet`, etc.

### Verification

After regenerating, confirm:
```python
# All these should return 0:
sum(1 for p in data if 'ampoules' in p.get('normalized_name_en', ''))  # Should be 0
sum(1 for p in data if 'sachets' in p.get('normalized_name_en', ''))   # Should be 0  
```

---

## Category 2 — `gm → mg` Bug STILL Active in Running Server

**Severity:** 🔴 Critical  
**Affected items:** Rows 3, 21, 22, 35, 40, 42, 43, 54, 63, 66, 67 (identical to v1 list)

### What's Happening

The CSV shows `60000 mg`, `30000 mg`, `50000 mg`, `185000 mg`, `85000 mg` — identical to the v1 CSV. This confirms **the server was not restarted** after applying the v1 code fix.

**The code fix IS correct.** Local testing confirms:
- `SUDOCREM 60GM CREAM` → `sudocrem 60 gm cream` ✅
- `ACRETIN 0.025% 30GM CREAM` → `acretin 0.025% 30 gm cream` ✅

### Fix Specification

No code change needed. **Restart the backend server** to pick up the v1 fix in `units.py → normalize_strength()`.

### Additional Refinement: 5 gm boundary case

Row 42: `AGIOLAX GRAN. 5GM 12SAC.` normalizes to `agiolax granules 12 sac. 5000 mg`.

The `5 gm` value is AT the threshold (≤ 5.0), so it converts to `5000 mg`. For sachets/granules, `5 gm` is clearly a **per-sachet weight**, not a drug dose. The heuristic should also consider form context:

```python
# In normalize_strength():
def g_to_mg(match):
    val = float(match.group(1))
    if val <= 5.0:
        return f"{int(val * 1000)} mg"
    return f"{match.group(1)} gm"
```

**Proposed refinement:** Lower the threshold from `5.0` to `2.0`, since drug doses above 2 gm expressed as grams are extremely rare (most are expressed as mg already). Alternatively, keep at 5.0 but add a post-conversion check: if the form token is `sachet`, `granules`, or `cream`, skip the conversion.

---

## Category 3 — Query-Side Noise Tokens Not Cleaned

**Severity:** 🟠 High  
**Affected items:** Rows 18, 31, 45, 58, 64, 77, 89, 91, 92, 94

### What's Happening

Several input patterns produce junk tokens that survive the pipeline and reduce match scores:

| Row | Input Pattern | Normalized Result | Problem |
|-----|--------------|-------------------|---------|
| 18 | `x10P` | `x 10 p` | `x` and `p` are noise tokens |
| 89 | `18P` | `18 p` | `p` is noise (means "pack") |
| 91 | `14PCS` | `14 pcs` | `pcs` is noise (means "pieces") |
| 77 | `30T.` | `30 t.` | `t.` should map to `tab` (added in v1 but `t.` has the dot still attached) |
| 58 | `12SACH.` | `12 sach.` | `sach.` should map to `sachet` (same issue) |
| 64 | `SYP.` | `syp.` | `syp.` should map to `syrup` |
| 42 | `SAC.` | `sac.` | `sac.` unmapped — should be `sachet` |

### Root Cause

The dot `.` is NOT in `STRIP_CHARS` (`r"[*|+/\-_\\(){}[\]\"']"`). So abbreviated tokens like `t.`, `sach.`, `syp.`, `sac.` retain their trailing dot. Even though the abbreviation map has `"t."` → `"tab"`, the regex-based abbreviation matcher may not match correctly at word boundaries when the dot is present.

Also, `x` and `p` / `pcs` packaging tokens are never stripped or normalized.

### Fix Specification

#### 3a. Add `.` to `STRIP_CHARS` or strip trailing dots specifically

**Option A** (recommended): Add a new step to strip trailing dots from tokens AFTER unit separation but BEFORE abbreviation mapping:

```python
def strip_trailing_dots(text: str) -> str:
    """Remove trailing dots from tokens (e.g., 'sach.' → 'sach')."""
    tokens = text.split()
    return " ".join(t.rstrip('.') for t in tokens)
```

Insert this step in the pipeline between `process_units` (step 2) and Arabic normalization (step 3).

**Option B**: Add `.` to `STRIP_CHARS`. This is more aggressive and could break `%` or other meaningful punctuation.

#### 3b. Map packaging noise tokens

Add to `ABBREVIATION_MAP`:
```python
"p":    "",        # Strip — packaging noise
"pcs":  "",        # Strip — packaging noise  
"x":    "",        # Strip — multiplication marker noise
"sac":  "sachet",  # Missing abbreviation
"sac.": "sachet",  # Missing abbreviation with dot
"syp":  "syrup",   # Already exists but needs "syp." variant
"sup":  "supp",    # Already referenced in v1
```

After stripping trailing dots (step 3a), the dot-suffixed variants become redundant, but they should remain as a safety net.

#### 3c. Pre-processing for `x10P` pattern

Before unit separation, add a regex step:
```python
def clean_packaging_notation(text: str) -> str:
    """Normalize packaging notation: 'x10P' → '10', 'x 10 p' → '10'."""
    # Remove leading 'x' before number+pack notation
    text = re.sub(r'\bx\s*(\d+)\s*p(?:cs)?\b', r'\1', text, flags=re.IGNORECASE)
    # Remove standalone packaging markers
    text = re.sub(r'\b(\d+)\s*p(?:cs)?\b', r'\1', text, flags=re.IGNORECASE)
    return text
```

---

## Category 4 — `%` Percent Double-Encoding

**Severity:** 🟡 Medium  
**Affected items:** Row 26 and any product with `%` notation

### What's Happening

The ABBREVIATION_MAP contains `"%": "percent"`. When a product like `ACYCLOVIR 5% 10MG CREAM` is processed:
1. The `%` character survives `STRIP_CHARS` (it's not in the strip list)
2. The abbreviation regex matches `%` and replaces it with `percent`
3. Result: `acyclovir 5%percent 10 mg cream` (double encoding!)

Meanwhile the DB has: `acyclovir 5 percent cream 10 gm`

### Fix Specification

**Option A** (recommended): Add `%` to `STRIP_CHARS` and remove it from `ABBREVIATION_MAP`. The `%` character itself is not useful for matching — the number before it (e.g., `5`) is what matters.

**Option B**: In `ABBREVIATION_MAP`, map `"%"` to `""` (empty string) so `5%` becomes just `5`.

**Option C**: Instead of stripping, ensure `%` is handled as a separator: `5%` → `5 percent` without the intermediate `5%` surviving.

---

## Category 5 — DB-Query Form Token Mismatch (`injectable` vs `ampoules`)

**Severity:** 🟠 High  
**Affected items:** Rows 33, 34, 36 (and many more in larger datasets)

### What's Happening

The query normalizes `AMP` → `injectable` (via `ABBREVIATION_MAP`).  
But the DB has `ampoules` for these specific entries (because the DB was normalized with the old pipeline).

Even after DB regeneration (Category 1), there's a deeper issue: the **DB pipeline runs `normalize_form_synonyms()` which maps `ampoule → injectable`**, but only if the token is already `ampoule` (singular). If the original DB name has `Ampoules` (plural), the pipeline goes:
1. `Ampoules` → lowercase → `ampoules`
2. `ampoules` → `map_abbreviations()` → ... hmm, `ampoules` IS now in the abbreviation map (added in v1) → `injectable`

So after v1 + regeneration, this should be fixed. **BUT** the `FORM_SYNONYM_MAP` still has a separate entry that does `ampoule → injectable`. This creates a double-mapping that's fragile.

### Fix Specification

Ensure the `FORM_SYNONYM_MAP` and `ABBREVIATION_MAP` are **consistent**:
- Both should resolve ampoule-family tokens to `injectable`
- The `ABBREVIATION_MAP` should be the single source of truth for form token normalization
- `FORM_SYNONYM_MAP` should only contain mappings that are NOT already in `ABBREVIATION_MAP`

Verify after DB regeneration that ALL ampoule entries in the DB now show `injectable`.

---

## Category 6 — Cosmetic Product Name Drift (Always, Adidas, Aloekita)

**Severity:** 🟡 Medium  
**Affected items:** Rows 28-31, 81-94, 70-74

### What's Happening

For consumer products with many variants (Always pads, Adidas sprays, Aloekita shampoos), the DB names have extra qualifiers not present in the input:

| Query | DB Name | Score | Missing tokens |
|-------|---------|-------|----------------|
| `always maxi long 8 pad` | `always protect plus maxi long 8 pads` | 75.0% | `protect`, `plus` |
| `always ultra long 16 pads` | `always slim protect ultra plus maxi long 16 pads` | 67.2% | `slim`, `protect`, `plus`, `maxi` |
| `adidas spray pure game` | `adidas game 48 h pure deodorant spray 150 ml` | 54.5% | `48`, `h`, `deodorant`, `150`, `ml` |
| `aloekita hair shampoo 200ml` | `aloekita caffeine shampoo 200 ml` | 80.4% | `caffeine` (wrong variant!) |

The v1 `LOW_WEIGHT_TOKENS` set already down-weights `protect`, `plus`, `slim`, etc. But the effect is insufficient because:
1. The unmatched token penalty denominator still accumulates many low-weight tokens
2. For DB entries with 8+ tokens where the query only has 4, even 0.1 weight per token adds up
3. The **wrong variant** can score higher than the correct one (Aloekita row 73)

### Fix Specification

#### 6a. Increase query-side coverage factor in scoring

Add a **coverage bonus**: if the query tokens are a near-complete subset of the candidate tokens (i.e., almost everything in the query appears in the candidate), boost the score:

```python
# In score_match():
query_coverage = len(matched_c_indices) / len(q_tokens) if q_tokens else 0
if query_coverage >= 0.8:
    final_score *= 1.10  # 10% bonus for high query coverage
```

#### 6b. Variant disambiguation for consumer products

For products like Always pads where many variants exist in the DB, the current scoring can't distinguish between them. Consider adding a **variant penalty**: if the query contains specific variant tokens (like `cottony`, `sensitive`, `breathable`) that don't appear in the candidate, apply a stronger penalty than for generic marketing tokens.

#### 6c. Expand LOW_WEIGHT_TOKENS

Add more DB-only marketing tokens that were observed in this dataset:
```python
LOW_WEIGHT_TOKENS.update({
    "48h", "72h", "deodorant", "cotton", "cottony",
    "breathable", "sensitive", "growth", "nourishing",
    "caffeine", "anti", "dandruff",
})
```

---

## Category 7 — `STRIP_CHARS` Doesn't Remove Key Punctuation

**Severity:** 🟡 Medium  
**Affected items:** Rows 42, 44, 45, 58, 64, 71, 77

### What's Happening

Current `STRIP_CHARS = r"[*|+/\-_\\(){}[\]\"']"` does NOT strip:
- `.` (dot) — leaves `t.`, `sach.`, `syp.`, `sac.` as-is
- `%` (percent) — causes double-encoding (see Category 4)
- `&` (ampersand) — appears in DB names like `Always Cotton Soft Maxi Thick & Extra Long`

### Fix Specification

Update `STRIP_CHARS` to include these characters:
```python
STRIP_CHARS = r"[*|+/\-_\\(){}[\]\"'.&]"
```

Or better, use a whitelist approach — only keep alphanumeric, space, and Arabic:
```python
STRIP_CHARS = r"[^a-zA-Z0-9\s\u0600-\u06FF]"
```

> [!WARNING]  
> Adding `.` to `STRIP_CHARS` must happen BEFORE unit separation, so `0.025%` doesn't become `0 025`. The current pipeline order already does cleaning first, then unit separation, so `0.025` inside a number pattern should be safe since `STRIP_CHARS` is applied via `remove_special_characters()` which uses regex, and `0.025` would become `0 025`. This is DANGEROUS.

**Safer approach**: Instead of adding `.` to `STRIP_CHARS`, add the `strip_trailing_dots()` step from Category 3a, which only strips dots at the END of tokens, not inside numbers.

---

## Category 8 — Missing or Incomplete Brand Resolution

**Severity:** 🟡 Medium  
**Affected items:** Rows 4, 5, 12, 15, 16, 27, 49, 50, 56

### What's Happening

Some brands or products simply don't exist in the reference DB, or the brand is only in the DB under a different form:

| Row | Input | Issue |
|-----|-------|-------|
| 4 | `123 EXTRA 20 TAB` | Brand "123" exists but is tokenized as a number → brand_tokens misses it |
| 5 | `123 SYP 120ML` | Same — "123" treated as number, not brand |
| 12 | `A TRIX` | Not in DB — atrix? Spelling mismatch |
| 15 | `ACETON SPRAY 50ML` | Not in DB — cosmetic product |
| 16 | `ACETONE LIZA 100ML` | Not in DB |
| 27 | `ADAPALENE0.1% GEL` | Query: `adapalene`, DB: `aknapalene` — different brand, same molecule |
| 49 | `ALBURHAN NATURAL OIL` | Not in DB |
| 50 | `ALCOHOL 75ML` | Too generic — matches random 75ml product |
| 56 | `ALICE BREEZE` | Not in DB |

### Fix Specification

These are **database coverage gaps**, not pipeline bugs. No normalization fix will help if the product simply isn't in the reference database.

For the numeric brand issue (rows 4, 5 — brand "123"):
- The `reorder_tokens()` step classifies standalone numbers as brand_tokens only if they have no following unit. `123` followed by `extra` gets classified correctly. But the scoring gives brand weight (3x) to the first token — and `123` as a brand is too short to get high similarity with any other brand.
- **Recommendation**: This is acceptable behavior. The matcher correctly identifies these as low-confidence matches. No fix needed.

---

## Summary Table: v2 Defects by Root Cause

| # | Root Cause | Severity | Items Affected | Fix Location |
|---|-----------|----------|----------------|--------------|
| 1 | Stale reference database | 🔴 Critical | ~15+ items | Re-run normalization pipeline |
| 2 | Server not restarted (v1 fixes inactive) | 🔴 Critical | ~12 items | Restart server |
| 3 | Query noise tokens (`x`, `p`, `pcs`, trailing dots) | 🟠 High | ~10 items | `cleaner.py` + `ABBREVIATION_MAP` |
| 4 | `%` double-encoding | 🟡 Medium | ~3 items | `ABBREVIATION_MAP` / `STRIP_CHARS` |
| 5 | DB-Query form token mismatch | 🟠 High | ~6 items | Fixed by Category 1 (DB regen) |
| 6 | Consumer product variant scoring | 🟡 Medium | ~15 items | `matcher.py` scoring refinements |
| 7 | `STRIP_CHARS` missing `.` and `%` | 🟡 Medium | ~7 items | `constants.py` + new pipeline step |
| 8 | Missing brands in DB | 🟡 Medium | ~9 items | Database coverage (not code) |

---

## Recommended Execution Order

1. **Restart the backend server** (0 effort — validates v1 fixes)
2. **Regenerate reference database** (1 command — fixes Category 1, 5)
3. **Add `strip_trailing_dots()` pipeline step** (Category 3a, 7)
4. **Add `clean_packaging_notation()` pre-processing** (Category 3c)
5. **Fix `%` handling** (Category 4)
6. **Expand `LOW_WEIGHT_TOKENS` + add coverage bonus** (Category 6)
7. **Re-run CSV export** and analyze improvements

---

## Expected Impact

| Metric | Current (v1 inactive) | After v1 + DB regen | After v2 fixes |
|--------|----------------------|---------------------|----------------|
| Matched | 28% | ~45% | ~55-60% |
| Review | 50% | ~40% | ~30-35% |
| No Match | 22% | ~15% | ~10% |
