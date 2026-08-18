# Specification: Drug Matcher Enhancement (v5)

## Goal
Improve matching coverage by tuning thresholds and filtering pharmaceutical "noise" words that frequently appear in database entries but are absent in query strings.

## Analysis of v4 "Review" Items
Analysis of the 280 items remaining in the "Review" bucket (Chunk 1) shows that:
1.  **Threshold Gap**: Many perfect matches have scores between **0.80 and 0.84**. They fall into "Review" simply because the query is slightly less descriptive than the database entry (e.g., missing a redundant unit like `5000 mg`).
2.  **Product Noise**: Database names often contain descriptive "noise" that doesn't appear in standard POS names, such as `advance stage`, `prefilled fridge`, and `dry powder`. These extra tokens currently penalize the match score.

## Proposed Changes

### 1. Adjust Default Thresholds
Lower the `match_threshold` to allow high-confidence matches to pass without manual review.
-   **Default Match Threshold**: 85% ➔ **80%**
-   **Review Threshold**: Remains at 50%

### 2. Expand `LOW_WEIGHT_TOKENS` (Noise Filter)
Add the following tokens to the low-weight list in `backend/tools/matcher.py` so they don't penalize the score when they only exist in one side of the match:
-   `advance`, `stage`, `prefilled`, `fridge`, `dry`, `powder`, `oral`, `coated`, `film`, `sugar`

### 3. Implementation Plan
1.  **Modify `backend/tools/matcher.py`**:
    -   Update `LOW_WEIGHT_TOKENS` set.
    -   Update default value for `--match-threshold` in `main()`.
2.  **Verify**:
    -   Run matcher on `sheet-3_chunk_1.xlsx` with the new settings.
    -   Verify that items like `cetal 1000 tab` (previously 0.849) now move to the "Matched" bucket.

## Expected Impact
-   **Review Rate**: Should drop from ~26% to under **20%**.
-   **Accuracy**: The brand penalty implemented in v4 provides enough safety to allow this threshold reduction without increasing false positives.
