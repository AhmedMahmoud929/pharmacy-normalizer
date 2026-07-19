"""
matcher_export.py — Custom column builder for matcher sheet exports.

Per spec: specs/matcher-custom-export.md
Appended AFTER the standard matched sheet fields in the exported Excel.
"""
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

import pandas as pd

from tools.csv_helper import load_sheet_from_path_safely

_tools_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_tools_dir)

ORIGINAL_COL_PREFIX = "orig_col_"


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

import posixpath
from typing import Union, List

def _extract_image_name(val: Union[str, List[str], None]) -> str:
    if not val:
        return ""
    if isinstance(val, list):
        names = [_extract_image_name(x) for x in val if x]
        return ", ".join(names)
    if isinstance(val, str):
        if "," in val:
            parts = val.split(",")
            names = [_extract_image_name(p.strip()) for p in parts if p.strip()]
            return ", ".join(names)
        clean_val = val.split("?")[0]
        return posixpath.basename(clean_val)
    return str(val)


def build_custom_columns(p: Optional[dict], override_price: Optional[float] = None, override_stock: Optional[int] = None, default_stock: int = 10, override_code: Optional[str] = None, override_international_barcode: Optional[str] = None) -> dict:
    """
    Given a product_data dict (from a matched result), return an ordered dict
    of the custom export columns defined in the spec.

    If p is None or empty (no_match rows), all values are "", except price/stock if provided.
    """
    if not p or not isinstance(p, dict):
        cols = _empty_columns()
        if override_price is not None:
            cols["price"] = override_price
        cols["current_stock"] = override_stock if override_stock is not None else default_stock
        if override_code is not None:
            cols["code"] = override_code
        if override_international_barcode is not None:
            cols["international_barcode"] = override_international_barcode
        return cols

    l1 = _get_l1(p)
    l2 = _get_l2(p)
    l3 = _get_l3(p)
    brand = _get_brand(p)

    image_url = p.get("image") or ""
    thumbnail = _extract_image_name(image_url)
    images = _extract_image_name(image_url)

    brand_logo_raw = brand.get("images") or brand.get("logo_url") or brand.get("image") or ""
    brand_logo = _extract_image_name(brand_logo_raw)

    price_val = override_price if override_price is not None else (p.get("price") or p.get("final_price") or 0.0)

    return {
        "name[en]":                  p.get("title_en") or p.get("name_en") or "",
        "name[ar]":                  p.get("title_ar") or p.get("name_ar") or "",
        "details[en]":               p.get("description_en") or p.get("meta_description_en") or "",
        "details[ar]":               p.get("description_ar") or p.get("meta_description_ar") or "",
        "price":                     price_val,
        "unit":                      p.get("unit") or "",
        "thumbnail":                 thumbnail,
        "images":                    images,
        "brand_name[en]":            brand.get("title_en") or brand.get("name_en") or "",
        "brand_name[ar]":            brand.get("title_ar") or brand.get("name_ar") or "",
        "brand_slug":                brand.get("slug") or "",
        "brand_logo":                brand_logo,
        "category_name[en]":         l1.get("title_en") or l1.get("name_en") or "",
        "category_name[ar]":         l1.get("title_ar") or l1.get("name_ar") or "",
        "category_slug":             l1.get("slug") or "",
        "sub_category_name[en]":     l2.get("title_en") or l2.get("name_en") or "",
        "sub_category_name[ar]":     l2.get("title_ar") or l2.get("name_ar") or "",
        "sub_category_slug":         l2.get("slug") or "",
        "sub_sub_category_name[en]": l3.get("title_en") or l3.get("name_en") or "",
        "sub_sub_category_name[ar]": l3.get("title_ar") or l3.get("name_ar") or "",
        "sub_sub_category_slug":     l3.get("slug") or "",
        "current_stock":             override_stock if override_stock is not None else default_stock,
        "code":                      override_code if override_code is not None else (p.get("code") or ""),
        "international_barcode":     override_international_barcode if override_international_barcode is not None else (p.get("international_barcode") or ""),
    }


def _empty_columns() -> dict:
    """Return all custom columns as empty strings (for no_match rows)."""
    keys = [
        "name[en]", "name[ar]", "details[en]", "details[ar]", "price", "unit",
        "thumbnail", "images",
        "brand_name[en]", "brand_name[ar]", "brand_slug", "brand_logo",
        "category_name[en]", "category_name[ar]", "category_slug",
        "sub_category_name[en]", "sub_category_name[ar]", "sub_category_slug",
        "sub_sub_category_name[en]", "sub_sub_category_name[ar]", "sub_sub_category_slug",
        "current_stock", "code", "international_barcode",
    ]
    return {k: "" for k in keys}


# ---------------------------------------------------------------------------
# Original uploaded sheet helpers
# ---------------------------------------------------------------------------

def get_job_original_file_path(job_id: str, filename: str) -> Optional[str]:
    ext = os.path.splitext(filename or "")[1].lower()
    if not ext:
        for candidate in (".xlsx", ".xls", ".csv"):
            path = os.path.join(_project_root, "data", "matcher", "jobs", job_id, f"original{candidate}")
            if os.path.exists(path):
                return path
        return None
    path = os.path.join(_project_root, "data", "matcher", "jobs", job_id, f"original{ext}")
    return path if os.path.exists(path) else None


def load_original_sheet(job_id: str, filename: str) -> Optional[pd.DataFrame]:
    path = get_job_original_file_path(job_id, filename)
    if not path:
        return None
    try:
        return load_sheet_from_path_safely(path)
    except Exception:
        return None


def get_original_column_names(job_id: str, filename: str) -> List[str]:
    df = load_original_sheet(job_id, filename)
    if df is None:
        return []
    return [str(col) for col in df.columns]


def original_col_field_id(index: int) -> str:
    return f"{ORIGINAL_COL_PREFIX}{index}"


def parse_original_col_field_id(field_id: str) -> Optional[int]:
    if not field_id.startswith(ORIGINAL_COL_PREFIX):
        return None
    try:
        return int(field_id[len(ORIGINAL_COL_PREFIX):])
    except ValueError:
        return None


def format_original_cell_value(val: Any) -> Any:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    if pd.isna(val):
        return ""
    if isinstance(val, (pd.Timestamp, datetime)):
        return val.isoformat()
    return val


def build_original_row_dict(df: Optional[pd.DataFrame], row_index: int) -> Dict[str, Any]:
    if df is None or row_index < 0 or row_index >= len(df):
        return {}
    row = df.iloc[row_index]
    return {
        str(col): format_original_cell_value(row[col])
        for col in df.columns
    }


def get_original_cell_value(
    df: Optional[pd.DataFrame],
    row_index: int,
    col_index: int,
) -> Any:
    if df is None or col_index < 0 or col_index >= len(df.columns):
        return ""
    if row_index < 0 or row_index >= len(df):
        return ""
    col_name = df.columns[col_index]
    return format_original_cell_value(df.iloc[row_index][col_name])

