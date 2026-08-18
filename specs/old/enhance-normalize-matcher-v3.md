# Specification: Drug Matcher Enhancement (v3)

## Goal
Resolve residual "Review" status items by collapsing specialized form synonyms (e.g., Emulgel → Gel), expanding noise token filtering for consumer goods, and fixing edge-case Arabic tokenization.

## Analysis of v2 Results
*   **Successes**: `x10P` logic fixed packaging noise; `gm` threshold fixed strength mismatches; Coverage bonus boosted Always/Adidas matches.
*   **Remaining Issues**:
    1.  **Form Synonyms**: `emulgel` vs `gel`, `creamy` vs `cream` still cause score drops.
    2.  **Stop Word Noise**: Words like `fridge` (ثلاجة), `egyptian` (مصري), and `card` (كارت) survive and act as high-weight mismatches.
    3.  **Variant Drift**: Non-essential brand qualifiers like `essentials`, `travel`, `travel-size` are treated as important tokens.
    4.  **Tokenization**: Some Arabic words are joined to English units (e.g., `penfilثلاجة`).

## Proposed Changes

### 1. Expand `FORM_SYNONYM_MAP`
Add more specialized forms to ensure they collapse to their base type:
*   `emulgel` → `gel`
*   `creamy` → `cream`
*   `oral` → (remove if redundant, usually noise)

### 2. Expand `LOW_WEIGHT_TOKENS`
Add more "marketing" and "variant" tokens that dilute scores:
*   `essentials`, `travel`, `size`, `random`, `color`, `choice`, `value`, `pack`, `breathable`, `protection`, `intensive`.

### 3. Update Arabic Stop Words & Abbreviation Map
*   Add `ثلاجة` (fridge), `مصري` (egyptian), `طقم` (set), `قطع` (pieces) to `ARABIC_STOP_WORDS`.
*   Add `كارت` → `card` to `ARABIC_TOKEN_MAP`.

### 4. Improve Unit Separation Regex
Update `process_units` to be more aggressive with boundaries between English and Arabic.

### 5. Implementation Plan

1.  **Modify `backend/normalizer/mappings/static/abbreviations.py`**:
    *   Add `emulgel`, `creamy` synonyms.
2.  **Modify `backend/normalizer/mappings/static/constants.py`**:
    *   Expand `ARABIC_STOP_WORDS`.
3.  **Modify `backend/tools/matcher.py`**:
    *   Expand `LOW_WEIGHT_TOKENS`.
4.  **Regenerate Reference DB**.
5.  **Restart Backend**.

## Expected Impact
*   **Accuracy**: Target > 75% Auto-Match.
*   **Review Rate**: Reduce "Review" items by another 15%.
