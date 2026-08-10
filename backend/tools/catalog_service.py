"""Load and reload the in-memory ProductIndex from SQLite."""

from __future__ import annotations

import json
import os
from typing import List, Optional, Tuple

from db import catalog_repo
from db.config import LEGACY_NORMALIZED_JSON, LEGACY_RAW_JSON
from db.schema import init_schema
from tools.matcher import ProductIndex


def load_catalog_index() -> Tuple[Optional[ProductIndex], List[dict]]:
    """
    Build ProductIndex from live catalog_products table.
    Returns (index, raw_products) or (None, []) if catalog is empty.
    """
    init_schema()
    count = catalog_repo.get_live_count()
    if count == 0:
        return _load_from_legacy_json()

    products = catalog_repo.load_live_products_for_index()
    if not products:
        return _load_from_legacy_json()

    return ProductIndex(products), products


def _load_from_legacy_json() -> Tuple[Optional[ProductIndex], List[dict]]:
    """Fallback for servers not yet migrated to SQLite."""
    json_path = LEGACY_NORMALIZED_JSON if os.path.exists(LEGACY_NORMALIZED_JSON) else LEGACY_RAW_JSON
    if not os.path.exists(json_path):
        return None, []
    with open(json_path, "r", encoding="utf-8") as f:
        products = json.load(f)
    if not isinstance(products, list) or not products:
        return None, []
    return ProductIndex(products), products
