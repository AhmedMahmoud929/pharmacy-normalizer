"""
matcher_export.py — Custom column builder for matcher sheet exports.

Per spec: specs/matcher-custom-export.md
Appended AFTER the standard matched sheet fields in the exported Excel.
"""
from typing import Optional


# ---------------------------------------------------------------------------
# Category helpers
# ---------------------------------------------------------------------------

def _get_l1(p: dict) -> dict:
    return p.get("level_one_category") or {}


def _get_l2(p: dict) -> dict:
    l2 = p.get("level_two_category") or []
    if isinstance(l2, dict):
        return l2
    if isinstance(l2, list) and l2:
        return l2[0] if isinstance(l2[0], dict) else {}
    return {}


def _get_l3(p: dict) -> dict:
    l3 = p.get("level_three_category") or []
    if isinstance(l3, dict):
        return l3
    if isinstance(l3, list) and l3:
        return l3[0] if isinstance(l3[0], dict) else {}
    return {}


def _get_brand(p: dict) -> dict:
    brand = p.get("brands") or p.get("brand") or {}
    return brand if isinstance(brand, dict) else {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_custom_columns(p: Optional[dict]) -> dict:
    """
    Given a product_data dict (from a matched result), return an ordered dict
    of the custom export columns defined in the spec.

    If p is None or empty (no_match rows), all values are "".
    """
    if not p or not isinstance(p, dict):
        return _empty_columns()

    l1 = _get_l1(p)
    l2 = _get_l2(p)
    l3 = _get_l3(p)
    brand = _get_brand(p)

    image_url = p.get("image") or ""
    thumbnail = image_url
    images = image_url  # comma-separated list per spec (single element here)

    return {
        # Core fields
        "name[en]":           p.get("title_en") or "",
        "name[eg]":           p.get("title_ar") or "",
        "details[en]":        p.get("description_en") or p.get("meta_description_en") or "",
        "details[eg]":        p.get("description_ar") or p.get("meta_description_ar") or "",
        "category_id":        l1.get("slug") or "",
        "sub_category_id":    l2.get("slug") or "",
        "sub_sub_category_id": l3.get("slug") or "",
        "brand_id":           brand.get("id") or "",
        "unit":               p.get("unit") or "",
        "thumbnail":          thumbnail,
        "images":             images,
        # Brand fields
        "brand_name_en":      brand.get("title_en") or "",
        "brand_name_ar":      brand.get("title_ar") or "",
        "brand_slug":         brand.get("slug") or "",
        "brand_logo_url":     brand.get("images") or brand.get("logo_url") or brand.get("image") or "",
        # Category L1
        "category_name_en":       l1.get("title_en") or "",
        "category_name_ar":       l1.get("title_ar") or "",
        "category_slug":          l1.get("slug") or "",
        # Category L2
        "sub_category_name_en":   l2.get("title_en") or "",
        "sub_category_name_ar":   l2.get("title_ar") or "",
        "sub_category_slug":      l2.get("slug") or "",
        # Category L3
        "sub_sub_category_name_en":  l3.get("title_en") or "",
        "sub_sub_category_name_ar":  l3.get("title_ar") or "",
        "sub_sub_category_slug":     l3.get("slug") or "",
    }


def _empty_columns() -> dict:
    """Return all custom columns as empty strings (for no_match rows)."""
    keys = [
        "name[en]", "name[eg]", "details[en]", "details[eg]",
        "category_id", "sub_category_id", "sub_sub_category_id",
        "brand_id", "unit", "thumbnail", "images",
        "brand_name_en", "brand_name_ar", "brand_slug", "brand_logo_url",
        "category_name_en", "category_name_ar", "category_slug",
        "sub_category_name_en", "sub_category_name_ar", "sub_category_slug",
        "sub_sub_category_name_en", "sub_sub_category_name_ar", "sub_sub_category_slug",
    ]
    return {k: "" for k in keys}
