# Specification: Drug Matcher Enhancement (v7)

## Goal
Achieve >75% automated match rate by fixing the "Size vs Dose" penalty over-correction and improving brand-name resilience through typo-tolerance and concatenation handling.

## Analysis of Mass Audit (Chunks 1 & 2)
The mass audit of 2,160 rows revealed:
1.  **Dose Over-Penalty**: Items like `azarga 10 ml` matching `azarga 5 ml` are correctly identified as the same product, but the numeric mismatch triggers a 30% penalty, dropping them into "Review".
2.  **Concatenation Gaps**: `hi forte` vs `highforte` fails because the space is a hard delimiter.
3.  **New Input Typos**: `syring`, `micro`, `wish`, `beby` are frequent unmatched tokens in the input.

## Proposed Changes

### 1. "Brand Continuity" Scoring Logic
Modify `score_match_detailed` in `matcher.py`:
-   **Old Logic**: If numbers don't match, `final_score *= 0.70`.
-   **New Logic**: If the **Brand** (first alphabetical token) is an **exact match** (similarity > 0.98), reduce the numeric mismatch penalty to `0.90` instead of `0.70`.
-   **Rationale**: Different sizes of the same drug are acceptable "Matched" candidates, whereas different drugs (different brands) should remain penalized.

### 2. Expanded Typo-Tolerant Synonyms
Add to `FORM_SYNONYM_MAP` in `abbreviations.py`:
-   `syring` ➔ `injectable`
-   `micro` ➔ `mcg`
-   `wish` ➔ `wash`
-   `beby` ➔ `baby`
-   `aml` ➔ `injectable` (misspelling of amp)
-   `vail` -> `injectable` (already exists, but ensuring coverage)

### 3. Handle Concatenated Brands
Modify `normalize.py` or the `ProductIndex` to optionally try matching brands without spaces if a direct match fails. 
- *Implementation detail*: In `ProductIndex.search`, if the top score is low, try a secondary search where the first two tokens of the query are concatenated.

## Expected Impact
-   **Matched Rate**: Expected jump to **75-80%**.
-   **Manual Review**: Significant reduction in "same brand, different size" review requests.
