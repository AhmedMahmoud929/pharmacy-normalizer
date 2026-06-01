"""
Dictionary-based token mapping.

Responsibilities:
  - Replace Arabic tokens with canonical English equivalents
  - Replace English abbreviations with canonical forms
  - Optionally convert Arabic number-words to digits
"""

import re
from normalizer.config import (
    ARABIC_TO_ENGLISH,
    ABBREVIATION_MAP,
    ARABIC_NUMBER_WORDS,
)
from normalizer.core.arabic import normalize_arabic_chars


def _build_normalized_arabic_map() -> dict[str, str]:
    """
    Pre-compute a version of ARABIC_TO_ENGLISH where every key
    has already been run through character normalization.

    This ensures that the input text (which has been normalized)
    will match the dictionary keys regardless of original form.
    """
    normalized = {}
    for arabic_key, english_val in ARABIC_TO_ENGLISH.items():
        norm_key = normalize_arabic_chars(arabic_key)
        normalized[norm_key] = english_val
        # Keep original key too in case it is already normalized
        normalized[arabic_key] = english_val
    return normalized


# Pre-computed at import time for performance
_NORM_ARABIC_MAP = _build_normalized_arabic_map()

# Compile a single regex pattern for all tokens (longest first)
_SORTED_ARABIC_KEYS = sorted(_NORM_ARABIC_MAP.keys(), key=len, reverse=True)
if _SORTED_ARABIC_KEYS:
    _ARABIC_TOKEN_REGEX = re.compile(
        r"(?<!\w)(" + r"|".join(re.escape(k) for k in _SORTED_ARABIC_KEYS) + r")(?!\w)"
    )
else:
    _ARABIC_TOKEN_REGEX = None


def map_arabic_tokens(text: str) -> str:
    """
    Replace Arabic tokens with their standardized English equivalents.

    Operates on whole tokens (word boundaries) to avoid partial matches.
    Longer keys are matched first to prevent substring collisions
    (e.g. "اقراص" before "قرص").
    """
    if not _ARABIC_TOKEN_REGEX:
        return text
        
    return _ARABIC_TOKEN_REGEX.sub(lambda m: _NORM_ARABIC_MAP[m.group(1)], text)


# Pre-compile abbreviation regex (longest keys first)
_SORTED_ABBR_KEYS = sorted(ABBREVIATION_MAP.keys(), key=len, reverse=True)
if _SORTED_ABBR_KEYS:
    _ABBR_REGEX = re.compile(
        r"(?<!\w)(" + r"|".join(re.escape(k) for k in _SORTED_ABBR_KEYS) + r")(?!\w)",
        re.IGNORECASE
    )
else:
    _ABBR_REGEX = None


def map_abbreviations(text: str) -> str:
    """
    Normalize English abbreviations to their canonical forms.
    Handles both single tokens and multi-token phrases (e.g., 'inf supp').
    """
    if not _ABBR_REGEX:
        return text

    return _ABBR_REGEX.sub(lambda m: ABBREVIATION_MAP[m.group(1).lower()], text)


def map_arabic_number_words(text: str) -> str:
    """
    Convert Arabic transliterations of English number words to digits.

    Examples:
      "وان"  → "1"
      "تو"   → "2"
      "ثري"  → "3"

    This step is optional and can be toggled in the pipeline config.
    """
    # Normalize the keys the same way we normalize input
    for arabic_word, digit in ARABIC_NUMBER_WORDS.items():
        norm_key = normalize_arabic_chars(arabic_word)
        pattern = r"(?<!\w)" + re.escape(norm_key) + r"(?!\w)"
        text = re.sub(pattern, digit, text)

    return text
