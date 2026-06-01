"""
Unit separation and formatting.

Responsibilities:
  - Split joined number+unit tokens ("120ml" → "120 ml")
  - Split joined number+abbreviation tokens ("28t" → "28 tab")
  - Handle dose expressions ("10mg" → "10 mg")
"""

import re
from normalizer.config import ABBREVIATION_MAP


def separate_number_units(text: str) -> str:
    """
    Insert a space between a number and an immediately following
    alphabetical unit (Latin or Arabic).

    Examples:
      "120ml"   → "120 ml"
      "10mg"    → "10 mg"
      "500مجم"  → "500 مجم"
      "28t"     → "28 t"
    """
    # Pattern: one or more digits (possibly with decimal point),
    # followed immediately by one or more letters (Latin or Arabic).
    text = re.sub(
        r"(\d+\.?\d*)\s*([a-zA-Z\u0600-\u06FF]+)",
        r"\1 \2",
        text,
    )
    return text


def separate_unit_numbers(text: str) -> str:
    """
    Insert a space between a unit and an immediately following number.

    Handles cases like "mg500" → "mg 500" (rare but occurs in messy data).
    """
    text = re.sub(
        r"([a-zA-Z\u0600-\u06FF]+)\s*(\d+\.?\d*)",
        r"\1 \2",
        text,
    )
    return text


def split_combo_units(text: str) -> str:
    """
    Handle combo dose notation like '5/160mg' -> '5 mg 160 mg'.
    This runs before regular unit separation to catch the '/' pattern.
    """
    # Pattern: digit/digit followed by unit
    text = re.sub(
        r"(\d+\.?\d*)/(\d+\.?\d*)\s*(mg|mcg|ml|gm|iu)\b",
        r"\1 \3 \2 \3",
        text,
        flags=re.IGNORECASE
    )
    # Also handle standalone combo numbers if needed (e.g., 5/160)
    # These will be split into '5 160'
    text = re.sub(r"(\d+)/(\d+)", r"\1 \2", text)
    return text


def process_units(text: str) -> str:
    """
    Run all unit-separation steps and standardize strengths.
    """
    text = split_combo_units(text)
    text = separate_number_units(text)
    text = separate_unit_numbers(text)
    
    # Standardize units (e.g., 0.5 g -> 500 mg)
    text = normalize_strength(text)
    
    return text


def normalize_strength(text: str) -> str:
    """
    Standardize common drug strengths to a single base (mg).
    Example: "0.5 g" -> "500 mg", "1 g" -> "1000 mg"
    """
    # 1. Convert Grams to Milligrams (e.g., "0.5 g" or "0.5 gm")
    def g_to_mg(match):
        val = float(match.group(1))
        # Heuristic: gm -> mg conversion only applies for values <= 5 gm,
        # since larger values (30gm cream, 100gm gel) are package weights.
        if val <= 5.0:
            return f"{int(val * 1000)} mg"
        return f"{match.group(1)} gm"

    text = re.sub(r"(\d+\.?\d*)\s*(?:g|gm|gram|grams)\b", g_to_mg, text, flags=re.IGNORECASE)
    
    # 2. Standardize "mcg" and "micrograms"
    text = re.sub(r"\b(?:microgram|micrograms|mcg)\b", "mcg", text, flags=re.IGNORECASE)
    
    # 3. Standardize "ml" and "milliliters"
    text = re.sub(r"\b(?:milliliter|milliliters|ml)\b", "ml", text, flags=re.IGNORECASE)
    
    return text
