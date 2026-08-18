"""Load and reload the in-memory ProductIndex from SQLite."""

from __future__ import annotations

from typing import List, Optional, Tuple

from db import catalog_repo
from db.schema import init_schema
from tools.matcher import ProductIndex


def load_catalog_index() -> Tuple[Optional[ProductIndex], List[dict]]:
    """
    Build ProductIndex from live catalog_products table.
    Returns (index, raw_products) or (None, []) if catalog is empty.
    """
    init_schema()
    products = catalog_repo.load_live_products_for_index()
    if not products:
        return None, []
    return ProductIndex(products), products
