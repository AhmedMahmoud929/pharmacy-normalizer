"""
Token reordering and standardization.

Ensures consistent token order:
  [brand/product] [dose] [form] [quantity/volume]

Where:
  - dose    = number + unit  (e.g. "10 mg", "125 mg")
  - form    = dosage form    (e.g. "tab", "cream", "syrup")
  - qty     = number + unit  (e.g. "28 tab", "120 ml")
  - brand   = everything else
"""

from normalizer.config import UNIT_TOKENS, FORM_TOKENS


def _is_number(token: str) -> bool:
    """Check if a token is a numeric value (int or float)."""
    try:
        float(token)
        return True
    except ValueError:
        return False


def reorder_tokens(text: str) -> str:
    """
    Reorder tokens into a consistent format:
      [brand tokens] [dose value] [dose unit] [form] [quantity value] [quantity unit]

    Strategy:
      1. Classify each token as: number, unit, form, or brand.
      2. Pair numbers with their adjacent units to form (value, unit) tuples.
      3. Identify dose vs quantity heuristically:
         - A number paired with mg/mcg/gm/iu is a dose.
         - A number paired with ml/l or a form token is quantity.
         - A number paired with a form is quantity of that form.
      4. Reassemble in canonical order.
    """
    tokens = text.split()

    if len(tokens) <= 1:
        return text

    # Classify tokens
    brand_tokens = []
    dose_parts = []       # e.g. ["10", "mg"]
    form_parts = []       # e.g. ["cream"]
    quantity_parts = []   # e.g. ["28", "tab"] or ["120", "ml"]

    i = 0
    while i < len(tokens):
        token = tokens[i]

        if _is_number(token):
            # Look ahead for a unit or form
            next_token = tokens[i + 1] if i + 1 < len(tokens) else None

            if next_token and next_token in UNIT_TOKENS:
                # This is a dose or volume measurement
                if next_token in {"mg", "mcg", "gm", "iu"}:
                    dose_parts.extend([token, next_token])
                else:
                    # ml, l → volume/quantity
                    quantity_parts.extend([token, next_token])
                i += 2
                continue

            elif next_token and next_token in FORM_TOKENS:
                # Number + form = quantity of that form (e.g. "28 tab")
                quantity_parts.extend([token, next_token])
                i += 2
                continue

            else:
                # Standalone number — likely part of the brand name (e.g. "123")
                brand_tokens.append(token)
                i += 1
                continue

        elif token in FORM_TOKENS:
            form_parts.append(token)
            i += 1
            continue

        elif token in UNIT_TOKENS:
            # Orphaned unit without a preceding number — keep as form-adjacent
            # This shouldn't happen after unit separation, but handle gracefully.
            form_parts.append(token)
            i += 1
            continue

        else:
            # Everything else is part of the brand/product name
            brand_tokens.append(token)
            i += 1
            continue

    # Assemble in canonical order:
    #   [brand] [dose] [form] [quantity]
    result_parts = []

    if brand_tokens:
        result_parts.extend(brand_tokens)
    if dose_parts:
        result_parts.extend(dose_parts)
    if form_parts:
        result_parts.extend(form_parts)
    if quantity_parts:
        result_parts.extend(quantity_parts)

    return " ".join(result_parts)
