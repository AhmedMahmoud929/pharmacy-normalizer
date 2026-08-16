"""Route discovery requests to platform-specific extractors."""

from __future__ import annotations

from typing import Any, Dict, List

from tools.discovery.extractors import chefaa, custom, shopify
from tools.discovery.extractors.base import SearchCandidate, UnifiedProduct


def _module_for_platform(platform: str):
    if platform == "chefaa":
        return chefaa
    if platform == "shopify":
        return shopify
    return custom


def search_products(query: str, profile: Dict[str, Any]) -> List[SearchCandidate]:
    platform = profile.get("platform") or "custom"
    mod = _module_for_platform(platform)
    return mod.search(query, profile)


def extract_product(url: str, profile: Dict[str, Any]) -> UnifiedProduct:
    platform = profile.get("platform") or "custom"
    mod = _module_for_platform(platform)
    return mod.extract_from_url(url, profile)


def extract_from_candidate(candidate: SearchCandidate, profile: Dict[str, Any]) -> UnifiedProduct:
    platform = profile.get("platform") or "custom"
    mod = _module_for_platform(platform)
    return mod.extract_from_candidate(candidate, profile)
