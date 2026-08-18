# Enhance Normalizer & Matcher — v1 Specification

**Based on analysis of:** `drug_matcher_analysis_2026-05-11T15-16-42.csv`  
**Scope:** 100 items · 26 Matched · 50 Review · 24 No Match

---

## Executive Summary

Analysis of the matching results reveals **five root-cause categories** that account for the vast majority of failures and false confidence scores. The biggest issue is a **critical bug in the `gm → mg` conversion** that converts package weights (e.g., `50gm cream`) into absurd dose values (e.g., `50000 mg`), completely destroying the match. Beyond that, the normalizer fails to handle Arabic-only product names with no English translation, miscellaneous abbreviations (`CC`, `INF`, `GEL`, `CR.`), and structural noise that inflates or deflates scores unfairly.

---

## Category 1 — Critical Bug: `gm` Conversion Applied to Package Weights

**Severity:** 🔴 Critical  
**Affected items:** Row 3, 11, 21, 22, 35, 40, 43, 54, 63, 66, 67, and more.

### What's Happening

The `normalize_strength()` function in `units.py` converts all `gm`-suffixed numbers to `mg` **before** the dose-equivalence threshold check in `equivalence.py`. As a result, package-weight values like `50gm` (cream size) are converted to `50000 mg` — a nonsensical dose value that breaks the entire match.

### Evidence from CSV

| Row | Original | Normalized (Broken) | Expected Normalized | Correct Match |
|-----|----------|---------------------|---------------------|---------------|
| 3 | `SUDOCREM 60GM CREAM` | `sudocrem 60000 mg cream` | `sudocrem 60 gm cream` | Sudocrem 60 gm Cream |
| 11 | `500 ML حمام كريم ارجان` | `حمام كريم ارجان 500 ml` | *(correct — ml is fine)* | — |
| 21 | `ACRETIN 0.025% 30GM CREAM` | `acretin 0.025% 30000 mg cream` | `acretin 0.025% 30 gm cream` | Acretin 0.025 % Cream 30 gm |
| 22 | `ACRETIN 0.05% 30GM CREAM` | `acretin 0.05% 30000 mg cream` | `acretin 0.05% 30 gm cream` | Acretin 0.05 % Cream 30 gm |
| 35 | `ADWIFLAM 50GM GEL` | `adwiflam 50000 mg gel` | `adwiflam 50 gm gel` | Adwiflam 50 gm Gel |
| 40 | `AGERA ACNE CREAM 50G` | `agera acne 50000 mg cream` | `agera acne cream 50 gm` | Agera Cream 50 gm |
| 43 | `AIG RELAX MASSAGE GEL 50G` | `aig relax 50000 mg massage gel` | `aig relax massage gel 50 gm` | — |
| 54 | `ALGESAL SURACTIVE 40G CR.` | `algesal suractive cr. 40000 mg` | `algesal suractive cream 40 gm` | — |
| 63 | `ALLERGEX 20GM CREAM` | `allergex 20000 mg cream` | `allergex cream 20 gm` | Allergex Cream 20 gm |
| 66 | `ALOE EVA CREAM 185G` | `aloe eva ... 185000 mg cream` | `aloe eva cream 185 gm` | Aloe Eva Hair cream with Aloe Vera 185 gm |
| 67 | `ALOE EVA CREAM HAIR 85 GM` | `aloe eva 85000 mg cream hair` | `aloe eva hair cream 85 gm` | Aloe Eva Hair cream with Aloe Vera 85 gm |

### Root Cause

`units.py → normalize_strength()` applies the regex `r"(\d+\.?\d*)\s*(?:g|gm|gram|grams)\b"` to ALL values, converting them to `mg`. The 5 gm threshold check lives only in `equivalence.py → normalize_dose_equivalence()`, which runs **after** the damage is already done by `normalize_strength()`. By then the value is already `50000 mg`, not `50 gm`, so the threshold guard is never triggered.

### Fix Specification

The `normalize_strength()` function **must** apply the same `MAX_DOSE_THRESHOLD` check (i.e., only convert if value ≤ 5 gm). Values above 5 gm should be kept as `{value} gm` without conversion. The `normalize_dose_equivalence()` redundant check can then stay as a safety net. Alternatively, remove the `gm → mg` conversion entirely from `normalize_strength()` and leave it exclusively to `normalize_dose_equivalence()`.

---

## Category 2 — Abbreviation / Suffix Not Mapped

**Severity:** 🟠 High  
**Affected items:** Rows 13, 15, 16, 33, 34, 36, 42, 44, 46, 48, 52, 58, 64, and more.

### What's Happening

Many product suffixes and abbreviations in the input are either not translated or translated inconsistently, causing the normalized query to diverge from the normalized database entry.

### Evidence from CSV

| Row | Problematic Abbreviation | Normalized As | Should Be |
|-----|--------------------------|---------------|-----------|
| 13 | `INF SUPP` | `infant supp` | `rectal suppository` / `suppository` |
| 15 | `ACETON SPRAY` (product-type noun) | `aceton spray` | *(depends on DB — but low score = wrong brand)* |
| 16 | `LIZA` (brand of acetone) | `acetone liza` | brand should be irrelevant to medical match |
| 33/34 | `AMP` (ampoule) | `injectable` | `ampoule` / `injectable` — inconsistently normalized |
| 36 | `AMB` | `amb` | unmapped — should be `ampoule` or `injectable` |
| 42 | `GRAN.` | `gran.` | `granules` |
| 44 | `CC` (cubic centimeters) | `cc` | `ml` (same unit, not translated) |
| 48 | `VAGINAL SUP` | `vaginal sup` | `vaginal suppository` |
| 52 | `ORAL SOL` | `oral solution` | `syrup` (or keep as `oral solution` — DB uses `syrup`) |
| 58 | `SACH.` | `sach.` | `sachets` |
| 64 | `CC` in `120CC SYP.` | `120 cc syp.` | `120 ml syrup` |

### Fix Specification

Extend `ABBREVIATION_MAP` (in `config.py` or `mapper.py`) with:

```python
# Volume / measurement
"cc":    "ml",
"c.c":   "ml",

# Dosage form / packaging
"supp":  "suppository",
"sup":   "suppository",
"inf supp": "infant suppository",  # multi-token
"gran":  "granules",
"gran.": "granules",
"sach":  "sachet",
"sach.": "sachet",
"amb":   "ampoule",
"cr":    "cream",
"cr.":   "cream",

# Form descriptors
"oral sol":       "oral solution",
"oral solution":  "syrup",           # only if DB is consistent
```

Multi-token abbreviations (e.g., `INF SUPP`) need a **bigram-level** replacement pass that runs before single-token mapping.

---

## Category 3 — Token Reordering Creates Score Divergence

**Severity:** 🟠 High  
**Affected items:** Rows 19, 26, 33, 34, 37, 41, 46, 52, 58, 59, 64, 65, and many more.

### What's Happening

The `reorder_tokens()` step rearranges tokens into `[brand] [dose] [form] [qty]` order. However, this sometimes creates a normalized string that **does not match the order used in the database's own normalization**, causing a sequence-similarity drop that hurts the `seq_match` component (30% weight).

Additionally, the reordering causes legitimate matches to score in the 63–79% range when they should be at 90%+, landing them in "Review" instead of "Matched."

### Evidence from CSV

| Row | Original | Normalized Query | Top Matched Name | Score | Issue |
|-----|----------|------------------|------------------|-------|-------|
| 18 | `ACETYLCISTEINE 200MG x10P` | `acetylcisteine x 10 p 200 mg` | Acetylcistein 200 mg 10 Sachets | 73.4% | `x 10 p` noise, reorder fails |
| 24 | `ACTRAPID 100IU/ML 5PENFILثلاجة` | `actrapid 5 penfilثلاجه 100 iu ml` | Insulin Actrapid 5 Penfills... | 62.8% | Mixed Arabic/English not cleaned |
| 33 | `ADOLOR 15MG 3AMP` | `adolor 15 mg 3 injectable` | Adolor 15 mg/1 ml 3 Ampoules | 63.6% | `ampoule` vs `injectable` |
| 36 | `ADWIFLAM 75MG 6AMB` | `adwiflam 6 amb 75 mg` | Adwiflam 75 mg/3 ml 6 Ampoules | 69.5% | `amb` unmapped, reorder wrong |
| 96 | `ALZENTAL 200MG 2TAB.` | `alzental 2 tab. 200 mg` | Alzental 200 mg 6 Tablets | 67.8% | CORRECT drug, wrong pack size; number penalty firing |

### Fix Specification

1. **Quantity token `x10P` / `x10` / `10P`**: Add a pre-processing step to normalize cross-multiplication patterns (`x 10 p` → `10 p`) and trailing packaging suffixes (`p` = pack, `pcs` = pieces → keep as `pcs`).
2. **Reordering consistency**: The same reordering must be applied to the reference database entries during pre-normalization. If the DB is normalized with `enable_reordering=True`, the query must also use it (and vice versa). Verify this is enforced at index build time.
3. **`ampoule` vs `injectable`**: Choose one canonical form and apply it to **both** the input normalizer and the database normalization. Current code maps `ampoule` → `injectable` in `normalize_form_synonyms()`, but if the database uses `ampoule` in its normalized names, the match will always fail.

---

## Category 4 — Arabic-Only / Mixed-Language Products Fail Entirely

**Severity:** 🟡 Medium  
**Affected items:** Rows 6, 7, 8, 9, 38, 49, 50, 51, 57.

### What's Happening

Products with Arabic-only names or significant Arabic content (where no English brand mapping exists) produce near-zero scores because the Arabic text is left as-is in the normalized query, while the database only has English normalized names.

### Evidence from CSV

| Row | Original | Normalized | Score | Problem |
|-----|----------|------------|-------|---------|
| 6 | `20 امواس حلاقة لورد` | `20 امواس حلاقه لورد` | 32.2% | "امواس حلاقة" (razor blades) not in Arabic map |
| 7 | `2منقار كارت` | `2 منقار كارت` | 34.4% | "منقار" (tweezers) not in Arabic map |
| 8 | `2منقار ملون` | `2 منقار ملون` | 34.4% | Same — different color, same product type |
| 9 | `3استيك علي كارت` | `3 استيك علي كارت` | 29.9% | "استيك" (stick/eyeliner) not in Arabic map |
| 38 | `AEROCHAMBER مصري` | `aerochamber مصري` | 45.3% | "مصري" = "Egyptian" — qualifier noise |
| 49 | `ALBURHAN NATURAL OIL اصفر` | `alburhan اصفر natural oil` | 27.2% | "اصفر" = "yellow" — color qualifier |
| 51 | `ALEGO شفاط مخاط` | `alego شفاط مخاط` | 34.6% | "شفاط مخاط" (nasal aspirator) not mapped |
| 57 | `ALICE طقم فرش مكياج 7 قطع` | `alice طقم فرش مكياج 7 قطع` | 38.9% | "طقم فرش مكياج" (makeup brush set) not mapped |

### Fix Specification

1. **Expand Arabic vocabulary map** (`mapper.py → ARABIC_TOKEN_MAP` or equivalent) with personal care and cosmetics vocabulary:
   ```python
   "امواس":    "blades",
   "حلاقة":   "shaving",
   "منقار":   "tweezer",
   "استيك":   "stick",
   "شفاط":    "aspirator",
   "مخاط":    "nasal",
   "طقم":     "set",
   "فرش":     "brushes",
   "مكياج":   "makeup",
   "قطع":     "pieces",
   "ملون":    "colored",
   "مصري":    "egyptian",   # or DROP as noise
   "اصفر":    "yellow",
   "كارت":    "card",
   ```
2. **Arabic qualifier stop-words**: Words like `مصري` (Egyptian/local variant), `اصفر/احمر/ازرق` (colors) are noise that do not exist in the reference DB's English names. Add them to the stop-word list if they don't help matching, OR map them to English so they can at least provide a partial match.
3. **Arabic-only product flagging**: If after full pipeline execution a normalized name still contains >50% Arabic tokens, flag it as `cannot_normalize` status with score 0 rather than producing a spurious match.

---

## Category 5 — Near-Miss Products Scored Too Low (Should Be "Matched")

**Severity:** 🟡 Medium

These are items the normalizer correctly identifies but the scoring does not reach the 85% match threshold, despite the top candidate being clearly the correct product.

### Evidence from CSV

| Row | Original | Matched Name | Score | Why Wrong |
|-----|----------|--------------|-------|-----------|
| 13 | `ABIMOL 300MG INF SUPP` | Abimol 300 mg 5 Rectal Suppositories | 51.0% | `inf supp` → `infant supp` ≠ `rectal suppository`; quantity missing |
| 26 | `ACYCLOVIR 5% 10MG CREAM` | Acyclovir 5% Cream 10 gm | 84.7% | `10mg` treated as dose but it's `10 gm` weight — just barely under threshold |
| 37 | `AERIUS 5MG 20TAB` | Aerius 5 mg 20 Film Coated Tablets | 76.0% | Extra `film coated` in DB penalizes score |
| 46 | `ALBENDAZOLE 30ML SUSP` | Albendazole 200 mg/5 ml Suspension 30 ml | 69.3% | Strength `200 mg` missing in input |
| 48 | `ALBOTHYL 8 VAGINAL SUP` | Albothyl 90 mg 8 Vaginal Suppositories | 64.0% | Strength `90 mg` missing; `sup` not mapped |
| 53 | `ALERTAM 180MG 10TAB` | Alertam 180 mg 10 Film Coated Tablets | 77.3% | Extra `film coated` in DB |
| 58 | `ALKA-MISR 12SACH.` | Alka Misr 12 Sachets | 79.3% | Hyphen, `sach.` partially mapped |
| 59 | `ALKAPRESS PLUS 5/160MG 14TAB` | Alkapress Plus 5 mg/160 mg 14 Film Coated Tablets | 77.6% | Combo dose `/` not tokenized correctly; `film coated` penalty |
| 77 | `ALPHINTERN 30T.` | Alphintern 30 Tablets | 77.3% | `t.` not mapped to `tab` |
| 96 | `ALZENTAL 200MG 2TAB.` | Alzental 200 mg 6 Tablets | 67.8% | Correct drug, different pack (2 vs 6) — numeric penalty fires unfairly |

### Fix Specification

1. **`Film Coated` / `Slow Release` / `Sustained Release` in DB names**: These qualifiers appear in the DB but almost never in the input sheet. The scoring engine should **treat them as optional/bonus tokens** rather than penalizing their absence. The unmatched candidate weight formula (`unmatched_c_weight`) currently counts every unmatched DB token equally — DB-side cosmetic descriptors should have weight ≈ 0.
2. **Combo dose `/` notation** (`5/160MG`): The `/` is not split, leaving `5/160` as a single token that cannot match `5` or `160` individually. Add a pre-processing step: `5/160mg` → `5 mg 160 mg`.
3. **`T.` / `TAB.`**: Add `t.` → `tab` to `ABBREVIATION_MAP`.
4. **Numeric mismatch penalty refinement (Row 96)**: The penalty fires when pack sizes differ (`2 tab` vs `6 tab`). Consider whether pack-size mismatch should trigger penalty vs. dose mismatch. Pack size (quantity) differences should produce a milder penalty than dose-strength differences.

---

## Category 6 — Cosmetic Descriptor Tokens in DB Inflate False Positives

**Severity:** 🟡 Medium  
**Affected items:** Rows 28, 29, 30, 31 (Adidas sprays), Rows 70, 73, 74 (Aloekita).

### What's Happening

Generic "Always" pads and "Adidas" deodorant sprays score in the 52–83% range regardless of variant, because the brand/volume tokens match but the variant-specific tokens (`Protect Plus`, `Slim`, `Maxi Thick`, etc.) in the DB name don't appear in the input. The scorer can't distinguish between `Always Maxi Thick` and `Always Ultra Slim Protect Plus`.

### Evidence from CSV

| Row | Original | Matched Name | Score | Problem |
|-----|----------|--------------|-------|---------|
| 31 | `ADIDAS SPRAY PURE GAME` | Adidas Pure Game Deodorant Spray (48H) 150 ml | 54.5% | `PURE GAME` reordered as `game spray pure`, misses `deodorant`, `48h`, `150 ml` |
| 84 | `ALWAYS MAXI LONG 8 PAD` | Always Protect Plus -Maxi Long 8 Pads | 75.0% | `protect plus` absent in input |
| 93 | `ALWAYS ULTRA LONG 16 PADS` | Always Ultra Slim Protect Plus -Maxi Long 16 Pads | 67.2% | `slim` and `protect plus` absent in input |

### Fix Specification

1. **Reduce weight of DB-only marketing tokens**: Tokens that frequently appear in DB but not in input sheets (e.g., `protect`, `plus`, `slim`, `film`, `coated`, `48h`, `deodorant`) should be added to a **low-weight token list**. Their absence should not count against the query during scoring.
2. **Candidate ranking by token coverage ratio**: Prefer candidates where the proportion of DB tokens found in the query is highest, rather than raw intersection score.

---

## Category 7 — Junk / Non-Pharmacy Items in Input Corrupt the Index Lookup

**Severity:** 🟢 Low  
**Affected items:** Rows 6, 7, 8, 9, 12, 55 (glass products), 51 (nasal aspirator), 57 (makeup set).

### What's Happening

Some input items are non-pharmaceutical (razors, combs, makeup brush sets) that have no equivalent in the pharmacy reference DB. These currently always return "no_match" with low scores, which is technically correct — but they waste processing time by searching the full index.

### Fix Specification

1. **Non-pharmacy category detection**: If a normalized query contains zero tokens that exist in the inverted index AND its token set overlaps < 10% with any indexed entry, immediately return `no_match` with score 0 without scoring all candidates.
2. **Optional: explicit blocklist**: A configurable `SKIP_PATTERNS` list (e.g., `razors`, `blades`, `shaving accessories`, etc.) to fast-reject known non-drug categories.

---

## Summary Table: Defects by Root Cause

| # | Root Cause | Severity | Items Affected | Fix Location |
|---|-----------|----------|----------------|--------------|
| 1 | `gm → mg` conversion applied to package weights | 🔴 Critical | ~12 items | `units.py → normalize_strength()` |
| 2 | Missing abbreviation mappings (`cc`, `amb`, `cr.`, etc.) | 🟠 High | ~15 items | `config.py → ABBREVIATION_MAP` |
| 3 | Token reordering diverges from DB normalized order | 🟠 High | ~20 items | `tokenizer.py`, DB re-normalization |
| 4 | Arabic tokens not mapped to English | 🟡 Medium | ~9 items | `mapper.py → ARABIC_TOKEN_MAP` |
| 5 | DB cosmetic tokens (`film coated`, etc.) penalize score | 🟡 Medium | ~10 items | `matcher.py → score_match()` |
| 6 | Combo dose `/` notation not tokenized | 🟡 Medium | ~3 items | `cleaner.py` or `units.py` |
| 7 | Numeric mismatch penalty too broad | 🟡 Medium | ~5 items | `matcher.py → score_match()` |
| 8 | Non-pharmacy items waste scoring cycles | 🟢 Low | ~8 items | `matcher.py → ProductIndex.search()` |

---

## Estimated Impact of Fixes

Applying fixes 1–5 is expected to:
- Promote ~12 `no_match` items to `matched` or `review` (fix #1 alone)
- Promote ~10 `review` items to `matched` (fixes #2, #3, #5, #6)
- Reduce false confidence for Arabic-only items (fix #4)

Conservatively, the matched rate should increase from 26% to **45–55%** with these changes, and the "Needs Review" set should be reduced by at least 30%.
