"""
product_export.py — Shared product export field mapping for browse catalog exports.

Output column headers align with the matcher ExportDialog field mapping.
"""
from typing import Any, Dict, List, Optional

from tools.matcher_export import build_custom_columns


def _get_variant(p: dict) -> dict:
    variants = p.get("product_variants") or []
    if variants and isinstance(variants[0], dict):
        return variants[0]
    return {}


def _brand_name(p: dict) -> str:
    brand = p.get("brand") or p.get("brands")
    if isinstance(brand, dict):
        return brand.get("name") or brand.get("title_en") or brand.get("name_en") or ""
    return brand or ""


def _category_name(p: dict) -> str:
    cat = p.get("category") or p.get("level_one_category")
    if isinstance(cat, dict):
        return cat.get("name") or cat.get("title_en") or cat.get("name_en") or ""
    return cat or ""


def build_product_export_record(
    p: dict,
    field_ids: List[str],
    *,
    index_code_helpers: Optional[dict] = None,
) -> Dict[str, Any]:
    """
    Build one export row for a catalog product using matcher-compatible column keys.
    """
    v = _get_variant(p)
    custom = build_custom_columns(p)
    helpers = index_code_helpers or {}
    record: Dict[str, Any] = {}

    for field_id in field_ids:
        if field_id == "id":
            record["product_id"] = v.get("id") or p.get("id") or ""
        elif field_id == "name_en":
            record["english_name"] = p.get("name_en") or p.get("title_en") or ""
        elif field_id == "name_ar":
            record["arabic_name"] = p.get("name_ar") or p.get("title_ar") or ""
        elif field_id == "sku":
            record["reference_sku"] = v.get("sku") or p.get("sku") or p.get("slug") or ""
        elif field_id == "brand":
            record["brand"] = _brand_name(p)
        elif field_id == "category":
            record["category"] = _category_name(p)
        elif field_id == "price":
            record["price"] = v.get("price") or p.get("price") or p.get("final_price") or 0
        elif field_id == "in_stock":
            stock_val = v.get("stock") or p.get("stock") or 0
            has_stock = stock_val > 0 or p.get("in_stock", True)
            record["in_stock"] = "Yes" if has_stock else "No"
        elif field_id == "stock":
            record["stock"] = v.get("stock") or p.get("stock") or 0
        elif field_id == "code":
            record["code"] = p.get("code") or ""
        elif field_id == "international_barcode":
            record["international_barcode"] = p.get("international_barcode") or ""
        elif field_id == "share_link":
            slug = p.get("slug") or ""
            record["share_link"] = f"https://chefaa.com/product/{slug}" if slug else ""
        elif field_id == "image":
            record["image"] = v.get("image") or p.get("image") or ""
        elif field_id == "image_name":
            record["image_name"] = p.get("image_name") or p.get("local_image_name") or ""
        elif field_id == "custom_name_en":
            record["name[en]"] = custom.get("name[en]", "")
        elif field_id == "custom_name_ar":
            record["name[ar]"] = custom.get("name[ar]", "")
        elif field_id == "custom_details_en":
            record["details[en]"] = custom.get("details[en]", "")
        elif field_id == "custom_details_ar":
            record["details[ar]"] = custom.get("details[ar]", "")
        elif field_id == "custom_price":
            record["price"] = custom.get("price", 0)
        elif field_id == "custom_unit":
            record["unit"] = custom.get("unit", "")
        elif field_id == "custom_thumbnail":
            record["thumbnail"] = custom.get("thumbnail", "")
        elif field_id == "custom_images":
            record["images"] = custom.get("images", "")
        elif field_id == "custom_brand_name_en":
            record["brand_name[en]"] = custom.get("brand_name[en]", "")
        elif field_id == "custom_brand_name_ar":
            record["brand_name[ar]"] = custom.get("brand_name[ar]", "")
        elif field_id == "custom_brand_slug":
            record["brand_slug"] = custom.get("brand_slug", "")
        elif field_id == "custom_brand_logo":
            record["brand_logo"] = custom.get("brand_logo", "")
        elif field_id == "custom_category_name_en":
            record["category_name[en]"] = custom.get("category_name[en]", "")
        elif field_id == "custom_category_name_ar":
            record["category_name[ar]"] = custom.get("category_name[ar]", "")
        elif field_id == "custom_category_slug":
            record["category_slug"] = custom.get("category_slug", "")
        elif field_id == "custom_sub_category_name_en":
            record["sub_category_name[en]"] = custom.get("sub_category_name[en]", "")
        elif field_id == "custom_sub_category_name_ar":
            record["sub_category_name[ar]"] = custom.get("sub_category_name[ar]", "")
        elif field_id == "custom_sub_category_slug":
            record["sub_category_slug"] = custom.get("sub_category_slug", "")
        elif field_id == "custom_sub_sub_category_name_en":
            record["sub_sub_category_name[en]"] = custom.get("sub_sub_category_name[en]", "")
        elif field_id == "custom_sub_sub_category_name_ar":
            record["sub_sub_category_name[ar]"] = custom.get("sub_sub_category_name[ar]", "")
        elif field_id == "custom_sub_sub_category_slug":
            record["sub_sub_category_slug"] = custom.get("sub_sub_category_slug", "")
        elif field_id == "custom_current_stock":
            record["current_stock"] = v.get("stock") or p.get("stock") or 0
        elif field_id == "custom_code":
            record["code"] = custom.get("code", "")
        elif field_id == "custom_international_barcode":
            record["international_barcode"] = custom.get("international_barcode", "")
        # Legacy browse column keys (backward compatible)
        elif field_id == "brand_index_code" and helpers.get("brand_index_code"):
            record["brand_index_code"] = helpers["brand_index_code"](p)
        elif field_id == "category_index_code" and helpers.get("category_index_code"):
            record["category_index_code"] = helpers["category_index_code"](p)
        elif field_id == "sub_category_index_code" and helpers.get("sub_category_index_code"):
            record["sub_category_index_code"] = helpers["sub_category_index_code"](p)
        elif field_id == "sub_sub_category_index_code" and helpers.get("sub_sub_category_index_code"):
            record["sub_sub_category_index_code"] = helpers["sub_sub_category_index_code"](p)
        elif field_id in p:
            val = p[field_id]
            if isinstance(val, dict):
                record[field_id] = val.get("name") or val.get("title_en") or ""
            else:
                record[field_id] = val

    return record
