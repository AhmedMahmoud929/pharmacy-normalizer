"""Validate and normalize international product barcodes (GTIN/EAN/UPC)."""

from __future__ import annotations

import re
from typing import Any, Iterable, Optional


def _gtin_check_digit(body: str) -> int:
    total = 0
    for i, ch in enumerate(reversed(body)):
        total += int(ch) * (3 if i % 2 == 0 else 1)
    return (10 - (total % 10)) % 10


def normalize_international_barcode(value: Any) -> str:
    """Return digits-only GTIN if value is a valid international barcode, else empty string."""
    if value is None:
        return ""
    raw = str(value).strip()
    if not raw:
        return ""

    digits = re.sub(r"\D", "", raw)
    if len(digits) not in (8, 12, 13, 14):
        return ""

    try:
        expected = _gtin_check_digit(digits[:-1])
        if expected != int(digits[-1]):
            return ""
    except ValueError:
        return ""

    return digits


def pick_international_barcode(*candidates: Any) -> str:
    for candidate in candidates:
        normalized = normalize_international_barcode(candidate)
        if normalized:
            return normalized
    return ""


def ld_json_barcode_candidates(ld_product: Optional[dict]) -> Iterable[Any]:
    if not isinstance(ld_product, dict):
        return []
    keys = (
        "gtin13",
        "gtin14",
        "gtin12",
        "gtin8",
        "gtin",
        "globalTradeItemNumber",
        "isbn",
    )
    values = [ld_product.get(key) for key in keys if ld_product.get(key)]
    offers = ld_product.get("offers")
    if isinstance(offers, dict):
        offers = [offers]
    if isinstance(offers, list):
        for offer in offers:
            if isinstance(offer, dict):
                for key in ("gtin13", "gtin12", "gtin8", "gtin"):
                    if offer.get(key):
                        values.append(offer.get(key))
    return values
