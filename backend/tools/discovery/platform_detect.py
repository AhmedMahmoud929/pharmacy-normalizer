"""Detect e-commerce platform from HTML content."""

from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse


def domain_from_url(url: str) -> str:
    parsed = urlparse(url if url.startswith("http") else f"https://{url}")
    host = (parsed.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def detect_platform(html: str, url: str = "") -> str:
    lower = (html or "").lower()
    host = domain_from_url(url) if url else ""

    if host == "chefaa.com" or "meilisearch.chefaa.com" in lower:
        return "chefaa"
    if (
        "cdn.shopify.com" in lower
        or "shopify-section" in lower
        or "shopify.shop" in lower
        or re.search(r"shopify\.com/s/files", lower)
    ):
        return "shopify"
    if "woocommerce" in lower or "wp-content" in lower and "product" in lower:
        return "woocommerce"
    return "custom"


def default_search_config(platform: str, domain: str) -> dict:
    if platform == "shopify":
        return {"type": "shopify_suggest"}
    if platform == "chefaa":
        return {"type": "meilisearch", "country": "eg"}
    return {
        "type": "url_template",
        "template": f"https://{domain}/search?q={{query}}",
    }


def default_extract_config(platform: str) -> dict:
    if platform == "shopify":
        return {
            "name": "h1.product__title, h1",
            "price": ".price-item--regular, .price__regular, .price-item",
            "image": ".product__media img, .product-single__photo img, img[src*='cdn.shopify.com']",
            "barcode": None,
            "price_divisor": 100,
        }
    return {
        "name": "h1",
        "price": ".price, [class*='price']",
        "image": "img[src*='product'], .product-image img, img",
        "barcode": None,
        "price_divisor": 1,
    }


def suggest_dom_elements(html: str) -> list:
    """Return common candidate selectors for manual teach mode."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html or "", "lxml")
    suggestions = []

    for tag in soup.find_all(["h1", "h2"], limit=5):
        text = tag.get_text(strip=True)
        if text:
            suggestions.append({"field_hint": "name", "selector": tag.name, "sample_text": text[:120]})

    for el in soup.select("[class*='price'], .price, [itemprop='price']")[:5]:
        text = el.get_text(strip=True)
        if text:
            cls = el.get("class") or []
            selector = f".{cls[0]}" if cls else el.name
            suggestions.append({"field_hint": "price", "selector": selector, "sample_text": text[:80]})

    for el in soup.select("img[src]")[:8]:
        src = el.get("src") or el.get("data-src") or ""
        if src and "logo" not in src.lower():
            cls = el.get("class") or []
            selector = f"img.{cls[0]}" if cls else "img"
            suggestions.append({"field_hint": "image", "selector": selector, "sample_text": src[:120]})

    return suggestions[:20]
