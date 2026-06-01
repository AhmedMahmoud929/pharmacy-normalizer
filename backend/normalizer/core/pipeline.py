"""
Composable normalization pipeline.

The pipeline is a chain of transformation functions, each taking a string
and returning a string.  Steps can be added, removed, or reordered.

Default pipeline order:
   1. General cleaning (lowercase, strip chars, collapse spaces)
   2. Unit separation (split "120ml" → "120 ml")
   3. Arabic normalization (char variants + diacritics)
   4. Arabic number-word mapping (optional, enabled by default)
   5. Arabic → English dictionary mapping
   6. Brand name translation (Arabic → English)
   7. Abbreviation normalization
   8. Form synonym collapsing (ampoule/injection → injectable)
   9. Dose equivalence (1 gm → 1000 mg)
  10. Token reordering
  11. Final whitespace cleanup
"""

from typing import Callable

from normalizer.core.cleaner import (
    clean, 
    collapse_whitespace, 
    remove_stop_words,
    clean_packaging_notation,
    strip_trailing_dots
)
from normalizer.core.arabic import normalize_arabic
from normalizer.core.mapper import map_arabic_tokens, map_abbreviations, map_arabic_number_words
from normalizer.core.units import process_units
from normalizer.core.tokenizer import reorder_tokens
from normalizer.core.equivalence import map_brands, normalize_form_synonyms, normalize_dose_equivalence

# Type alias for a normalization step
Step = Callable[[str], str]


def create_pipeline(
    enable_arabic_numbers: bool = True,
    enable_reordering: bool = True,
    enable_brand_mapping: bool = True,
    enable_form_synonyms: bool = True,
    enable_dose_conversion: bool = True,
    enable_arabic: bool = True,
    extra_steps: list[Step] | None = None,
) -> Callable[[str], str]:
    """
    Build a normalization pipeline with configurable options.

    Args:
        enable_arabic_numbers:  Convert Arabic number-words
                                (e.g. "وان" → "1"). Default: True.
        enable_reordering:      Reorder tokens into canonical
                                [brand] [dose] [form] [qty] order.
                                Default: True.
        enable_brand_mapping:   Translate Arabic brand names to
                                canonical English (e.g. "بانادول" → "panadol").
                                Default: True.
        enable_form_synonyms:   Collapse equivalent dosage forms
                                (e.g. ampoule/injection → injectable).
                                Default: True.
        enable_dose_conversion: Convert equivalent doses to canonical
                                unit (e.g. 1 gm → 1000 mg).
                                Default: True.
        enable_arabic:          Enable all Arabic processing steps
                                (normalization, stop words, number words,
                                token mapping, brand translation).
                                Set to False to skip Arabic handling.
                                Default: True.
        extra_steps:            Additional transformation functions to
                                append at the end of the pipeline.

    Returns:
        A single function that accepts a raw product name string
        and returns the normalized form.
    """
    steps: list[Step] = []

    # 1. General cleaning
    steps.append(clean)
    
    # 1.5 Strip trailing dots early (but after clean so we have lowercase/no special chars)
    # This helps subsequent steps like unit detection and mapping
    steps.append(strip_trailing_dots)

    # 1.6 Noise reduction for packaging
    steps.append(clean_packaging_notation)

    # 2. Unit separation and dose normalization
    steps.append(process_units)

    # 3-6. Arabic processing
    if enable_arabic:
        steps.append(normalize_arabic)
        steps.append(remove_stop_words)
        if enable_arabic_numbers:
            steps.append(map_arabic_number_words)
        steps.append(map_arabic_tokens)
        if enable_brand_mapping:
            steps.append(map_brands)

    # 6.5 Percent cleanup (convert 5% -> 5 to avoid double encoding)
    steps.append(lambda t: t.replace('%', ' '))

    # 7. Abbreviation normalization
    steps.append(map_abbreviations)

    # 8. Form synonym collapsing
    if enable_form_synonyms:
        steps.append(normalize_form_synonyms)

    # 9. Dose equivalence conversion
    if enable_dose_conversion:
        steps.append(normalize_dose_equivalence)

    # 10. Token reordering
    if enable_reordering:
        steps.append(reorder_tokens)

    # 11. Final whitespace cleanup and lowercase
    steps.append(collapse_whitespace)
    steps.append(lambda t: t.lower())

    # Append any user-supplied extra steps
    if extra_steps:
        steps.extend(extra_steps)

    def run_pipeline(text: str) -> str:
        """Execute the full normalization pipeline on a single input string."""
        for step in steps:
            text = step(text)
        return text

    return run_pipeline


# Default pipeline instance — covers the most common use case
_default_pipeline = create_pipeline()


def normalize(text: str) -> str:
    """
    Normalize a product name using the default pipeline configuration.

    This is the primary entrypoint for quick usage:
        from normalizer import normalize
        normalize("*CIPRALEX 10MG 28T")
        # => "cipralex 10 mg 28 tab"
    """
    return _default_pipeline(text)
