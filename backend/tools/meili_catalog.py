"""
Fetch Chefaa catalog products via Meilisearch API only — no HTML scraping.
"""

from __future__ import annotations

import importlib.util
import os
from typing import Any, Callable, Dict, List, Optional

ProgressCallback = Callable[[int, str], None]

_FETCH_FN = None


def _get_fetch_fn():
    global _FETCH_FN
    if _FETCH_FN is not None:
        return _FETCH_FN

    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    main_path = os.path.join(backend_root, "tools", "shefaa-crawler", "main.py")
    if not os.path.exists(main_path):
        raise FileNotFoundError(f"Crawler module not found at {main_path}")

    spec = importlib.util.spec_from_file_location("shefaa_crawler_main", main_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _FETCH_FN = module.fetch_products_from_meili
    return _FETCH_FN


def normalize_meili_hit(hit: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure Meilisearch hit matches catalog import field expectations."""
    product = dict(hit)
    if not product.get("id"):
        product["id"] = product.get("slug") or product.get("objectID")
    if not product.get("slug") and product.get("id"):
        product["slug"] = str(product["id"])
    return product


def fetch_all_products(
    country: str = "eg",
    *,
    on_progress: Optional[ProgressCallback] = None,
    should_cancel: Optional[Callable[[], bool]] = None,
    max_products: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Download the full product catalog from Chefaa's Meilisearch index.
    No web scraping — API only.
    """
    fetch_fn = _get_fetch_fn()

    def _report(count: int, message: str) -> None:
        if on_progress:
            on_progress(count, message)

    _report(0, "Connecting to Meilisearch API…")
    hits = fetch_fn(
        country=country,
        category_slug=None,
        on_progress=_report,
        should_cancel=should_cancel,
        max_products=max_products,
    )
    products = [normalize_meili_hit(h) for h in hits]
    _report(len(products), f"Fetched {len(products):,} products from Meilisearch")
    return products
