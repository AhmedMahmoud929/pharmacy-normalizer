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


def _web_search_fallback_config() -> dict:
    return {
        "enabled": True,
        "providers": ["google_cse", "brave", "duckduckgo"],
        "sleep_seconds": 2.5,
        "ban_sleep_seconds": 90,
        "max_retries": 2,
    }


def default_search_config(platform: str, domain: str) -> dict:
    fallback = _web_search_fallback_config()
    if platform == "shopify":
        return {"type": "shopify_suggest", "link_patterns": [r"/products/"], "fallback": fallback}
    if platform == "chefaa":
        return {"type": "meilisearch", "country": "eg"}
    return {
        "type": "url_template",
        "template": f"https://{domain}/search?q={{query}}",
        "link_patterns": [r"/products/", r"/product/", r"/shop/[^/?#]+", r"med\.php"],
        "exclude_link_patterns": [r"/shop/category/", r"\?search=", r"\?order=", r"/category/"],
        "fallback": fallback,
    }


def infer_search_config(html: str, url: str, domain: str, platform: str) -> dict:
    """Refine search config using the sample product page (Odoo /shop, forms, etc.)."""
    config = default_search_config(platform, domain)
    if platform != "custom":
        return config

    sample = url if url.startswith("http") else f"https://{url}"
    parsed = urlparse(sample)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    path = (parsed.path or "").lower()

    if "/shop/" in path and "/category/" not in path:
        config["template"] = f"{origin}/shop?search={{query}}"
        config["link_patterns"] = [r"/shop/[^/?#]+", r"/products/", r"/product/", r"med\.php"]
        config["exclude_link_patterns"] = [
            r"/shop/category/",
            r"\?search=",
            r"\?order=",
            r"/category/",
        ]
        return config

    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html or "", "lxml")
    for form in soup.select("form[action]"):
        action = form.get("action") or ""
        if not re.search(r"search|shop", action, re.I):
            continue
        action_url = action if action.startswith("http") else f"{origin}{action if action.startswith('/') else '/' + action}"
        input_name = None
        for inp in form.select("input[name]"):
            name = (inp.get("name") or "").lower()
            if name in ("q", "query", "search", "keyword", "text", "s"):
                input_name = inp.get("name")
                break
        if input_name:
            sep = "&" if "?" in action_url else "?"
            config["template"] = f"{action_url}{sep}{input_name}={{query}}"
            return config

    return config


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
        "name_ar": "h2",
        "price": "meta[property='og:price:amount'], meta[property='product:price:amount'], [itemprop='price'], .price, [class*='price']",
        "image": "meta[property='og:image'], meta[property='og:image:secure_url']",
        "brand": "meta[property='product:brand'], .brand, [class*='brand']",
        "barcode": None,
        "price_divisor": 1,
    }


def suggest_dom_elements(html: str) -> list:
    """Return common candidate selectors for manual teach mode."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html or "", "lxml")
    suggestions = []

    og_image = soup.select_one("meta[property='og:image'], meta[property='og:image:secure_url']")
    if og_image and og_image.get("content"):
        suggestions.append(
            {
                "field_hint": "image",
                "selector": "meta[property='og:image']",
                "sample_text": og_image.get("content", "")[:120],
            }
        )

    og_title = soup.select_one("meta[property='og:title']")
    if og_title and og_title.get("content"):
        suggestions.append(
            {
                "field_hint": "name_ar",
                "selector": "meta[property='og:title']",
                "sample_text": og_title.get("content", "")[:120],
            }
        )

    for tag in soup.find_all(["h1", "h2"], limit=5):
        text = tag.get_text(strip=True)
        if text:
            hint = "name_ar" if re.search(r"[\u0600-\u06FF]", text) else "name"
            suggestions.append({"field_hint": hint, "selector": tag.name, "sample_text": text[:120]})

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
