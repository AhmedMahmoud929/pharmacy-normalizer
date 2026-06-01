"""
Centralized configuration for all dictionaries and mappings.

Mappings are now split into separate files in the mappings/ directory for better maintainability.
No code changes needed in processing modules as they still import from this central file.
"""

from .mappings.manager import MappingDBManager

# Initialize Database Manager
_db = MappingDBManager()

# Load Dynamic Mappings from SQLite
BRAND_MAP = _db.get_brand_map()
ARABIC_TO_ENGLISH = _db.get_token_map()

# Static Mappings (Rules and Constants that change rarely)
from .mappings.static.abbreviations import ABBREVIATION_MAP, FORM_SYNONYM_MAP
from .mappings.static.rules import DOSE_CONVERSIONS, ARABIC_NUMBER_WORDS
from .mappings.static.constants import (
    ARABIC_CHAR_MAP,
    ARABIC_DIACRITICS_PATTERN,
    STRIP_CHARS,
    ARABIC_STOP_WORDS,
)

# These are derived or still static for now
from .mappings.static.categories import UNIT_TOKENS, FORM_TOKENS

# Export all for backwards compatibility
__all__ = [
    "BRAND_MAP",
    "ARABIC_TO_ENGLISH",
    "ABBREVIATION_MAP",
    "FORM_SYNONYM_MAP",
    "DOSE_CONVERSIONS",
    "ARABIC_NUMBER_WORDS",
    "ARABIC_CHAR_MAP",
    "ARABIC_DIACRITICS_PATTERN",
    "STRIP_CHARS",
    "UNIT_TOKENS",
    "FORM_TOKENS",
    "ARABIC_STOP_WORDS",
]