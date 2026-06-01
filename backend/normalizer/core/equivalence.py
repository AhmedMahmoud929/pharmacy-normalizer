"""
Brand, form, and dose equivalence normalization.

Responsibilities:
  - Map Arabic brand names to canonical English brands (exact + fuzzy)
  - Collapse form synonyms (ampoule/injection → injectable)
  - Convert equivalent doses (1 gm → 1000 mg)
"""

import re
import unicodedata
from normalizer.config import BRAND_MAP, FORM_SYNONYM_MAP, DOSE_CONVERSIONS
from normalizer.core.arabic import normalize_arabic_chars


# ---------------------------------------------------------------------------
#  Levenshtein distance — pure Python, no dependencies
# ---------------------------------------------------------------------------
def _levenshtein(a: str, b: str) -> int:
    """Compute the Levenshtein edit distance between two strings."""
    if len(a) < len(b):
        return _levenshtein(b, a)

    if len(b) == 0:
        return len(a)

    prev_row = list(range(len(b) + 1))

    for i, ca in enumerate(a):
        curr_row = [i + 1]
        for j, cb in enumerate(b):
            # Insertion, deletion, substitution
            cost = 0 if ca == cb else 1
            curr_row.append(min(
                curr_row[j] + 1,       # insertion
                prev_row[j + 1] + 1,   # deletion
                prev_row[j] + cost,    # substitution
            ))
        prev_row = curr_row

    return prev_row[-1]


# ---------------------------------------------------------------------------
#  Fuzzy matching config
# ---------------------------------------------------------------------------
# Max absolute edit distance allowed for a fuzzy match
FUZZY_MAX_DISTANCE = 2

# Max relative distance (fraction of the longer word's length)
# Prevents short words from false-matching (e.g. "للرجال" ≠ "لوريال")
FUZZY_MAX_RATIO = 0.20

# Minimum word length to attempt fuzzy matching (in characters)
FUZZY_MIN_LENGTH = 4


# ---------------------------------------------------------------------------
#  Brand map construction (exact + fuzzy-ready)
# ---------------------------------------------------------------------------
def _build_normalized_brand_map() -> dict[str, str]:
    """
    Build a version of BRAND_MAP where every key has been through
    Arabic character normalization (أ/إ/آ → ا, ة → ه, ى → ي).
    """
    normalized = {}
    for arabic_brand, english_brand in BRAND_MAP.items():
        norm_key = normalize_arabic_chars(arabic_brand)
        normalized[norm_key] = english_brand
        normalized[arabic_brand] = english_brand
    return normalized


_NORM_BRAND_MAP = _build_normalized_brand_map()

# Pre-compute list of (normalized_arabic_key, english_brand) for fuzzy search
_FUZZY_CANDIDATES: list[tuple[str, str]] = list(_NORM_BRAND_MAP.items())

# Compile a single regex pattern for all exact brand matches (longest first)
_SORTED_BRAND_KEYS = sorted(_NORM_BRAND_MAP.keys(), key=len, reverse=True)
if _SORTED_BRAND_KEYS:
    _BRAND_REGEX = re.compile(
        r"(?<!\w)(" + r"|".join(re.escape(k) for k in _SORTED_BRAND_KEYS) + r")(?!\w)"
    )
else:
    _BRAND_REGEX = None


def _is_arabic_word(word: str) -> bool:
    """Check if a word contains Arabic characters."""
    return any("\u0600" <= ch <= "\u06FF" for ch in word)


def _fuzzy_brand_lookup(token: str) -> str | None:
    """
    Find the closest brand match for an Arabic token using edit distance.

    Returns the English brand name if a match is found within the
    configured distance/ratio thresholds, otherwise None.

    Strategy:
      1. Skip tokens shorter than FUZZY_MIN_LENGTH
      2. Compute edit distance against every known brand key
      3. Accept the best match if:
         - distance ≤ FUZZY_MAX_DISTANCE
         - distance / max(len(token), len(candidate)) ≤ FUZZY_MAX_RATIO
    """
    if len(token) < FUZZY_MIN_LENGTH:
        return None

    best_match: str | None = None
    best_distance = FUZZY_MAX_DISTANCE + 1

    for candidate_key, english_brand in _FUZZY_CANDIDATES:
        # Quick length check — if lengths differ by more than max distance, skip
        if abs(len(token) - len(candidate_key)) > FUZZY_MAX_DISTANCE:
            continue

        dist = _levenshtein(token, candidate_key)

        if dist == 0:
            # Exact match — shouldn't reach here normally, but handle it
            return english_brand

        max_len = max(len(token), len(candidate_key))
        ratio = dist / max_len

        if dist <= FUZZY_MAX_DISTANCE and ratio <= FUZZY_MAX_RATIO and dist < best_distance:
            best_distance = dist
            best_match = english_brand

    return best_match


def map_brands(text: str) -> str:
    """
    Replace Arabic brand names with their canonical English equivalents.

    Two-pass approach:
      1. Exact match — fastest, handles all brands in BRAND_MAP directly
      2. Fuzzy match — catches misspellings and transliteration variants

    Examples:
      "بانادول"    → "panadol"   (exact)
      "اوجمنتين"   → "augmentin" (exact)
      "اوتروفين"   → "otrivin"   (fuzzy — edit distance 1 from "اوتريفين")
      "اوترفين"    → "otrivin"   (fuzzy — edit distance 1 from "اوتريفين")
    """
    # Pass 1: Exact matches (longest-first) using single compiled regex
    if _BRAND_REGEX:
        text = _BRAND_REGEX.sub(lambda m: _NORM_BRAND_MAP[m.group(1)], text)

    # Pass 2: Fuzzy match remaining Arabic tokens
    tokens = text.split()
    result = []
    for token in tokens:
        if _is_arabic_word(token):
            fuzzy_match = _fuzzy_brand_lookup(token)
            if fuzzy_match:
                result.append(fuzzy_match)
            else:
                result.append(token)
        else:
            result.append(token)

    return " ".join(result)


def normalize_form_synonyms(text: str) -> str:
    """
    Collapse equivalent dosage form names into a single canonical form.

    Examples:
      "ampoule"   → "injectable"
      "injection" → "injectable"
    """
    tokens = text.split()
    result = []
    for token in tokens:
        if token in FORM_SYNONYM_MAP:
            result.append(FORM_SYNONYM_MAP[token])
        else:
            result.append(token)
    return " ".join(result)


def normalize_dose_equivalence(text: str) -> str:
    """
    Convert doses to a canonical unit so equivalent doses match.

    Examples:
      "1 gm"    → "1000 mg"
      "0.5 gm"  → "500 mg"
      "500 mg"  → "500 mg"  (unchanged — already in target unit)
      "30 gm"   → "30 gm"  (unchanged — likely a package weight, not a dose)

    Only converts when the number is followed by a source unit.
    Handles integer results cleanly (no ".0" suffix).

    Heuristic: gm → mg conversion only applies for values ≤ 5 gm,
    since larger values (30gm cream, 100gm gel) are package weights.
    """
    # Max source values for each conversion to distinguish dose vs weight
    MAX_DOSE_THRESHOLDS = {
        "gm": 5.0,  # Doses above 5gm are almost certainly package weights
    }

    tokens = text.split()
    result = []
    i = 0

    while i < len(tokens):
        converted = False

        # Check if current token is a number followed by a convertible unit
        if i + 1 < len(tokens):
            try:
                value = float(tokens[i])
                unit = tokens[i + 1]

                for source_unit, target_unit, multiplier in DOSE_CONVERSIONS:
                    if unit == source_unit:
                        threshold = MAX_DOSE_THRESHOLDS.get(source_unit)
                        # Skip conversion if value exceeds the dose threshold
                        if threshold is not None and value > threshold:
                            break
                        new_value = value * multiplier
                        # Format cleanly: 1000.0 → "1000", 500.5 → "500.5"
                        if new_value == int(new_value):
                            result.append(str(int(new_value)))
                        else:
                            result.append(str(new_value))
                        result.append(target_unit)
                        i += 2
                        converted = True
                        break

            except ValueError:
                pass

        if not converted:
            result.append(tokens[i])
            i += 1

    return " ".join(result)
