# Specification: Drug Matcher Enhancement (v4)

## Goal
Eliminate "Generic Overlap" false positives (where dose/form match but the brand name doesn't) and map remaining edge-case abbreviations (like `ampoul` -> `injectable`) based on real-world data from a 1,000+ item dataset.

## Analysis of 10k Chunk Results (Chunk 1)
*   **Successes**: The two-pass scoring system runs incredibly fast. Coverage bonus correctly prioritizes items with full query coverage.
*   **Remaining Issues**:
    1.  **Generic Overlap False Positives**: Items like `acitretin 25 mg 30 cap` match `unitrin 25 mg 30 cap` with high Jaccard/Sequence scores because `25, mg, 30, cap` match perfectly, ignoring the total mismatch of the main brand name (`acitretin` vs `unitrin`).
    2.  **Missing Form Synonyms**: Words like `ampoul`, `suppositories`, and `caplets` are missing from the `FORM_SYNONYM_MAP`, causing them to be treated as unmatched tokens.
    3.  **Missing Database Entries**: Items like `123` (123 Cold & Flu) and `actifed` are simply missing from the reference database. The matcher fails correctly here, but this is a data gap.
    4.  **More Noise Tokens**: Tokens like `instant`, `granules`, `topical`, and `flavor` act as noise.

## Proposed Changes

### 1. Implement "First-Word Brand Penalty"
In pharmaceuticals, the first word of the product string is almost always the brand name or the primary active ingredient. 

**The Rule:** If the query's first word (e.g., `acitretin`) does NOT exist *anywhere* in the candidate product's name, it is fundamentally a different product. We must apply a massive penalty (e.g., cut the final score in half: `final_score *= 0.50`). 

This ensures that even if all the other words (dose, units, packaging) match perfectly, the missing brand name will instantly sink the score into the `no_match` category, preventing false positives.

### 2. Expand `FORM_SYNONYM_MAP`
Add missing pharmaceutical form synonyms to `backend/normalizer/mappings/static/abbreviations.py`:
*   `suppositories` -> `supp`
*   `suppository` -> `supp`
*   `ampoul` -> `injectable`
*   `ampoules` -> `injectable`
*   `ampoule` -> `injectable`
*   `amp` -> `injectable`
*   `caplet` -> `tab`
*   `caplets` -> `tab`
*   `efer` -> `effervescent`
*   `eff` -> `effervescent`
*   `penfills` -> `penfill`
*   `hfa` -> `inhaler`

### 3. Expand `LOW_WEIGHT_TOKENS`
Add more noise tokens to `backend/tools/matcher.py`:
*   `instant`, `granules`, `in`, `topical`, `flavor`

### 4. Implementation Plan
1.  **Modify `backend/tools/matcher.py`**: Add the First-Token Brand Penalty to `score_match_detailed()`.
2.  **Modify `backend/normalizer/mappings/static/abbreviations.py`**: Add the new form synonyms.
3.  **Regenerate Reference DB**: Required after any mapping change.
4.  **Run Matcher on Chunk 1**: Re-test to verify the "Generic Overlaps" have dropped to `no_match`.

## Expected Impact
*   **Accuracy**: Will eliminate almost all false positive `review` matches.
*   **Review Rate**: The "Review" bucket should shrink significantly, leaving only true marginal matches.
