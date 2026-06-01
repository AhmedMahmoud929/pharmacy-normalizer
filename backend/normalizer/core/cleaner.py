"""
General text cleaning utilities.

Responsibilities:
  - Lowercase conversion
  - Strip special characters
  - Collapse whitespace
"""

import re
from normalizer.config import STRIP_CHARS, ARABIC_STOP_WORDS


def to_lowercase(text: str) -> str:
    """Convert the entire string to lowercase."""
    return text.lower()


def remove_special_characters(text: str) -> str:
    """Remove special characters defined in STRIP_CHARS config."""
    return re.sub(STRIP_CHARS, " ", text)


def collapse_whitespace(text: str) -> str:
    """Replace multiple spaces / tabs / newlines with a single space and strip edges."""
    return re.sub(r"\s+", " ", text).strip()


def strip_trailing_dots(text: str) -> str:
    """
    Remove trailing dots from tokens (e.g., 'sach.' -> 'sach').
    This is safer than stripping all dots which might be needed for decimals.
    """
    tokens = text.split()
    return " ".join(t.rstrip('.') for t in tokens)


def clean_packaging_notation(text: str) -> str:
    """
    Normalize packaging notation: 'x10P' -> '10', 'x 10 p' -> '10'.
    Removes common but non-essential markers for pieces/packs.
    """
    import re
    # Remove leading 'x' before number+pack notation
    text = re.sub(r'\bx\s*(\d+)\s*p(?:cs)?\b', r'\1', text, flags=re.IGNORECASE)
    # Remove standalone packaging markers (e.g., "14 p")
    text = re.sub(r'\b(\d+)\s*p(?:cs)?\b', r'\1', text, flags=re.IGNORECASE)
    return text


def remove_stop_words(text: str) -> str:
    """
    Remove generic medical stop words (like مضاد, حيوي) that act as noise.
    Uses word boundaries (with negative lookbehinds/lookaheads for Arabic)
    to avoid deleting sub-words.
    """
    if not ARABIC_STOP_WORDS:
        return text

    words = text.split()
    filtered = [w for w in words if w not in ARABIC_STOP_WORDS]
    return " ".join(filtered)


def separate_scripts(text: str) -> str:
    """
    Separate English and Arabic scripts with a space.
    Example: 'penfilثلاجة' -> 'penfil ثلاجة'
    """
    # From English to Arabic
    text = re.sub(r"([a-zA-Z])([\u0600-\u06FF])", r"\1 \2", text)
    # From Arabic to English
    text = re.sub(r"([\u0600-\u06FF])([a-zA-Z])", r"\1 \2", text)
    return text


def clean(text: str) -> str:
    """
    Run all general cleaning steps in sequence.

    Pipeline order:
      1. lowercase
      2. separate scripts
      3. remove special characters
      4. collapse whitespace
    """
    text = to_lowercase(text)
    text = separate_scripts(text)
    text = remove_special_characters(text)
    text = collapse_whitespace(text)
    return text
