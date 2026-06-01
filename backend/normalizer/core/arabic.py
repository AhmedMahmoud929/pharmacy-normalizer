"""
Arabic-specific text normalization.

Responsibilities:
  - Character normalization (أ/إ/آ → ا, ة → ه, ى → ي)
  - Diacritics (tashkeel) removal
"""

import re
from normalizer.config import ARABIC_CHAR_MAP, ARABIC_DIACRITICS_PATTERN


def normalize_arabic_chars(text: str) -> str:
    """
    Normalize variant Arabic characters to their canonical forms.

    Uses ARABIC_CHAR_MAP from config:
      أ, إ, آ  →  ا
      ة        →  ه
      ى        →  ي
    """
    for src, dst in ARABIC_CHAR_MAP.items():
        text = text.replace(src, dst)
    return text


def remove_diacritics(text: str) -> str:
    """
    Strip Arabic diacritical marks (tashkeel) such as
    fatha, damma, kasra, shadda, sukun, etc.
    """
    return re.sub(ARABIC_DIACRITICS_PATTERN, "", text)


def normalize_arabic_digits(text: str) -> str:
    """
    Convert Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to English digits (0123456789).
    """
    arabic_indic_digits = "٠١٢٣٤٥٦٧٨٩"
    english_digits = "0123456789"
    translation_table = str.maketrans(arabic_indic_digits, english_digits)
    return text.translate(translation_table)


def normalize_arabic(text: str) -> str:
    """
    Run all Arabic normalization steps:
      1. Remove diacritics first (before char normalization)
      2. Normalize character variants
      3. Convert Arabic digits to English
    """
    text = remove_diacritics(text)
    text = normalize_arabic_chars(text)
    text = normalize_arabic_digits(text)
    return text
