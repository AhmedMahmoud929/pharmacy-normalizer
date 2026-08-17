"""Chefaa Meilisearch discovery extractor."""

from __future__ import annotations

import json
import re
import urllib.request
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

from tools.discovery.extractors.base import SearchCandidate, UnifiedProduct

MEILI_URL = "https://meilisearch.chefaa.com/indexes/products_{country}/search"
MEILI_TOKEN = "aa66bf66db30dea9b9746c8f6397d7a0112a055c70d80527b300c3dec85fcc41"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Authorization": f"Bearer {MEILI_TOKEN}",
    "Content-Type": "application/json",
}


def _meili_search(query: str, country: str = "eg", limit: int = 10) -> List[Dict[str, Any]]:
    url = MEILI_URL.format(country=country.lower())
    payload = {"q": query, "limit": limit}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=HEADERS,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        parsed = json.loads(res.read().decode("utf-8"))
    return parsed.get("hits") or []


def _hit_to_product(hit: Dict[str, Any], domain: str = "chefaa.com") -> UnifiedProduct:
    title_en = hit.get("title_en") or hit.get("name_en") or ""
    title_ar = hit.get("title_ar") or hit.get("name_ar") or ""
    price = hit.get("final_price") or hit.get("price")
    image = hit.get("image") or ""
    slug = hit.get("slug") or str(hit.get("id") or "")
    share = hit.get("full_url") or hit.get("share_link") or ""
    if not share and slug:
        share = f"https://chefaa.com/eg-en/now/product/{slug}"

    brand = ""
    brands = hit.get("brands")
    if isinstance(brands, dict):
        brand = brands.get("title_en") or brands.get("name_en") or ""

    return UnifiedProduct(
        title_en=title_en,
        title_ar=title_ar,
        price=float(price) if price is not None else None,
        image_url=image,
        images=[image] if image else [],
        barcode=str(
            pick_international_barcode(
                hit.get("international_barcode"),
                hit.get("barcode"),
            )
        ),
        source_url=share,
        source_domain=domain,
        brand=brand,
        slug=slug,
        raw=hit,
    )


def search(query: str, profile: Dict[str, Any]) -> List[SearchCandidate]:
    search_cfg = profile.get("search_config") or {}
    country = search_cfg.get("country") or "eg"
    hits = _meili_search(query, country=country, limit=10)
    candidates = []
    for hit in hits:
        title = hit.get("title_en") or hit.get("title_ar") or hit.get("slug") or ""
        slug = hit.get("slug") or str(hit.get("id") or "")
        url = hit.get("full_url") or hit.get("share_link") or f"https://chefaa.com/eg-en/now/product/{slug}"
        price = hit.get("final_price") or hit.get("price")
        candidates.append(
            SearchCandidate(
                title=title,
                url=url,
                price=float(price) if price is not None else None,
                image_url=hit.get("image") or "",
                raw=hit,
            )
        )
    return candidates


def extract_from_url(url: str, profile: Dict[str, Any]) -> UnifiedProduct:
    """For Chefaa, re-search by slug if URL provided."""
    slug_match = re.search(r"/product/([^/?#]+)", url or "")
    query = slug_match.group(1).replace("-", " ") if slug_match else url
    hits = _meili_search(query, limit=1)
    if hits:
        return _hit_to_product(hits[0])
    raise ValueError("Product not found on Chefaa")


def extract_from_candidate(candidate: SearchCandidate, profile: Dict[str, Any]) -> UnifiedProduct:
    return _hit_to_product(candidate.raw, domain=profile.get("domain") or "chefaa.com")
