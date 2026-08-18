# Specification: Drug Matcher Enhancement (v6)

## Goal
Improve the matching accuracy of "Mid Score Reviews" (0.50 - 0.69) and "High No Match" (0.40 - 0.49) items by expanding our synonym maps to include common misspellings/typos and adding secondary noise tokens identified in Chunk 2.

## Analysis of Chunk 2 Errors
After running chunk 2 and extracting the low-scoring items, several clear patterns emerged:
1.  **Form Typos**: Words like `ampl` and `vail` are failing to match `injectable` because they are misspelled versions of `ampoul` and `vial`. `pacets` is failing to match `sachet`.
2.  **Missing Abbreviations**: `vag` is not matching `vaginal`.
3.  **Secondary Noise**: Words like `delayed`, `release`, `prolonged`, `infantile`, `action`, `double`, `paint`, and `wipes` are acting as noise and penalizing valid matches.

## Proposed Changes

### 1. Typo-Tolerant Form Synonyms
Add common spelling mistakes and missing abbreviations to `FORM_SYNONYM_MAP` in `abbreviations.py`:
-   `ampl`, `vail` ➔ `injectable`
-   `pacets`, `packets`, `bags` ➔ `sachet`
-   `vag` ➔ `vaginal`
-   `botelle` ➔ `bottle`

### 2. Expand `LOW_WEIGHT_TOKENS` (Secondary Noise)
Add the newly discovered noise tokens to `matcher.py`:
-   `delayed`, `release`, `prolonged`, `infantile`, `action`, `double`, `paint`, `wet`, `wipes`, `liquid`

### 3. Implementation Plan
1.  **Modify `abbreviations.py`**: Add the new typo-tolerant synonyms.
2.  **Modify `matcher.py`**: Expand the `LOW_WEIGHT_TOKENS` set.
3.  **Regenerate Database**: Run `tools/normalize.py` to ensure the new synonyms are applied to the 60k reference database.
4.  **Verify**: Re-run matching on `sheet-3_chunk_2.xlsx` to confirm improvements.

## Expected Impact
-   **Matched Rate**: Should climb higher as items blocked by typos (`ampl`, `pacets`) are correctly normalized.
-   **Review Rate**: Should drop as secondary noise tokens are neutralized.
