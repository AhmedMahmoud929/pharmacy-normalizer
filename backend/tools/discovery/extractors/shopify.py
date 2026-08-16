"""Shopify store discovery extractor."""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from tools.discovery.extractors.base import SearchCandidate, UnifiedProduct
from tools.discovery.html_fetcher import fetch_html
from tools.discovery.platform_detect import domain_from_url

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/html",
}

_BAD_IMAGE_KEYWORDS = ("authentic", "badge", "logo", "placeholder", "icon")


def _base_url(domain: str) -> str:
    return f"https://{domain}"


def _fetch_json(url: str) -> Any:
    req = urllib.request.Request(url, headers=HEADERS, method="GET")
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode("utf-8"))


def _parse_price(raw: Any, divisor: float = 100.0) -> Optional[float]:
    if raw is None:
        return None
    try:
        val = float(str(raw).replace(",", "").strip())
        if divisor and divisor > 1:
            if val >= 100:
                return round(val / divisor, 2)
        return round(val, 2)
    except (TypeError, ValueError):
        text = re.sub(r"[^\d.]", "", str(raw))
        try:
            return float(text) if text else None
        except ValueError:
            return None


def _abs_url(base: str, path: str) -> str:
    if not path:
        return ""
    if path.startswith("//"):
        return "https:" + path
    if path.startswith("http"):
        return path
    return urljoin(base, path)


def _extract_handle(url: str) -> Optional[str]:
    match = re.search(r"/products/([^/?#]+)", url or "")
    return match.group(1) if match else None


def _store_origin(url: str, domain: str) -> str:
    parsed = urlparse(url if url.startswith("http") else f"https://{domain}{url}")
    return f"{parsed.scheme}://{parsed.netloc}"


def _localized_url(url: str, locale_prefix: str) -> str:
    """Build /ar/... variant of a product URL when locale prefix is missing."""
    parsed = urlparse(url if url.startswith("http") else f"https://{url}")
    path = parsed.path or ""
    prefix = f"/{locale_prefix.strip('/')}"
    if path.startswith(prefix + "/") or path == prefix:
        return url
    return f"{parsed.scheme}://{parsed.netloc}{prefix}{path}"


def _is_bad_image(url: str) -> bool:
    lower = (url or "").lower()
    return any(keyword in lower for keyword in _BAD_IMAGE_KEYWORDS)


def _collect_images(product: Dict[str, Any], base: str) -> List[str]:
    images: List[str] = []
    seen: set[str] = set()

    def add(src: Any) -> None:
        if not src:
            return
        if isinstance(src, dict):
            src = src.get("url") or src.get("src") or src.get("image") or ""
        full = _abs_url(base, str(src))
        if not full or _is_bad_image(full) or full in seen:
            return
        seen.add(full)
        images.append(full)

    add(product.get("featured_image"))
    add(product.get("image"))
    for img in product.get("images") or []:
        add(img)

    media = product.get("media") or []
    for item in media:
        if isinstance(item, dict):
            add(item.get("src") or item.get("preview_image", {}).get("src"))

    return images


def _fetch_product_js(origin: str, handle: str) -> Optional[Dict[str, Any]]:
    js_url = f"{origin.rstrip('/')}/products/{handle}.js"
    try:
        return _fetch_json(js_url)
    except Exception:
        return None


def _extract_ld_json_product(html: str) -> Optional[Dict[str, Any]]:
    for block in re.findall(
        r'<script type="application/ld\+json"[^>]*>(.*?)</script>',
        html or "",
        re.DOTALL | re.IGNORECASE,
    ):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            item_type = str(item.get("@type") or "").lower()
            if item_type == "product":
                return item
            if item_type == "itemlist":
                for element in item.get("itemListElement") or []:
                    prod = element.get("item") if isinstance(element, dict) else None
                    if isinstance(prod, dict) and str(prod.get("@type", "")).lower() == "product":
                        return prod
    return None


def _title_from_html(html: str) -> str:
    soup = BeautifulSoup(html or "", "lxml")
    h1 = soup.select_one("h1.product__title, h1")
    if h1:
        return h1.get_text(strip=True)
    og = soup.select_one('meta[property="og:title"]')
    if og and og.get("content"):
        return og["content"].strip()
    return ""


def _fetch_localized_title(url: str, locale_prefix: str) -> str:
    localized = _localized_url(url, locale_prefix)
    if localized == url:
        return _title_from_html(fetch_html(url))
    try:
        html = fetch_html(localized)
    except Exception:
        return ""
    ld = _extract_ld_json_product(html)
    if ld and ld.get("name"):
        return str(ld["name"]).strip()
    return _title_from_html(html)


def search(query: str, profile: Dict[str, Any]) -> List[SearchCandidate]:
    domain = profile.get("domain") or ""
    base = _base_url(domain)
    encoded = urllib.parse.quote(query)
    url = f"{base}/search/suggest.json?q={encoded}&resources[type]=product&resources[limit]=10"
    try:
        data = _fetch_json(url)
    except Exception:
        html = fetch_html(f"{base}/search?q={encoded}")
        return _parse_search_html(html, base)

    products = (
        data.get("resources", {}).get("results", {}).get("products")
        or data.get("products")
        or []
    )
    candidates = []
    for p in products:
        title = p.get("title") or ""
        handle = p.get("handle") or ""
        product_url = p.get("url") or f"/products/{handle}"
        if not product_url.startswith("http"):
            product_url = urljoin(base, product_url)
        price = _parse_price(p.get("price"), divisor=100)
        image = p.get("featured_image") or p.get("image") or ""
        if isinstance(image, dict):
            image = image.get("url") or image.get("src") or ""
        candidates.append(
            SearchCandidate(
                title=title,
                url=product_url,
                price=price,
                image_url=_abs_url(base, image),
                raw=p,
            )
        )
    return candidates


def _parse_search_html(html: str, base: str) -> List[SearchCandidate]:
    soup = BeautifulSoup(html or "", "lxml")
    candidates = []
    for a in soup.select("a[href*='/products/']")[:10]:
        href = a.get("href") or ""
        title = a.get_text(strip=True)
        if title and href:
            candidates.append(
                SearchCandidate(
                    title=title,
                    url=_abs_url(base, href),
                    raw={"href": href},
                )
            )
    return candidates


def extract_from_url(url: str, profile: Dict[str, Any]) -> UnifiedProduct:
    domain = profile.get("domain") or domain_from_url(url)
    origin = _store_origin(url, domain)
    extract_cfg = profile.get("extract_config") or {}
    divisor = float(extract_cfg.get("price_divisor") or 100)

    handle = _extract_handle(url)
    product_json: Optional[Dict[str, Any]] = None
    if handle:
        product_json = _fetch_product_js(origin, handle)

    html = fetch_html(url)
    if not product_json:
        product_json = _extract_shopify_embedded_json(html)

    ld_product = _extract_ld_json_product(html)

    title_en = ""
    title_ar = ""
    price: Optional[float] = None
    barcode = ""
    brand = ""
    slug = handle or ""
    images: List[str] = []
    raw: Dict[str, Any] = {}

    if product_json:
        raw = product_json
        title_en = product_json.get("title") or ""
        brand = product_json.get("vendor") or ""
        slug = product_json.get("handle") or slug
        variants = product_json.get("variants") or []
        variant = variants[0] if variants else {}
        price = _parse_price(
            variant.get("price") or product_json.get("price"),
            divisor=divisor,
        )
        barcode = str(variant.get("barcode") or variant.get("sku") or "")
        images = _collect_images(product_json, origin)

    if ld_product:
        if not title_en:
            title_en = str(ld_product.get("name") or "").strip()
        if price is None:
            offers = ld_product.get("offers") or {}
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            if isinstance(offers, dict):
                price = _parse_price(offers.get("price"), divisor=1)
        if not images:
            ld_image = ld_product.get("image")
            if isinstance(ld_image, dict):
                ld_image = ld_image.get("url") or ld_image.get("image")
            if ld_image:
                images = _collect_images({"images": [ld_image]}, origin)

    if not title_en:
        title_en = _title_from_html(html)

    # Arabic title from /ar/ version of same product path
    title_ar = _fetch_localized_title(url, "ar")
    if title_ar and title_ar == title_en:
        title_ar = ""

    if not images:
        og_image = BeautifulSoup(html, "lxml").select_one('meta[property="og:image"]')
        if og_image and og_image.get("content"):
            images = _collect_images({"images": [og_image["content"]]}, origin)

    if not product_json and not ld_product:
        from tools.discovery.extractors.custom import extract_with_config

        fallback = extract_with_config(html, url, domain, origin, extract_cfg)
        return UnifiedProduct(
            title_en=fallback.title_en or title_en,
            title_ar=fallback.title_ar or title_ar,
            price=fallback.price if fallback.price is not None else price,
            image_url=fallback.image_url or (images[0] if images else ""),
            images=fallback.images or images,
            barcode=fallback.barcode or barcode,
            source_url=url,
            source_domain=domain,
            brand=fallback.brand or brand,
            slug=slug,
            raw=raw or fallback.raw,
        )

    return UnifiedProduct(
        title_en=title_en,
        title_ar=title_ar,
        price=price,
        image_url=images[0] if images else "",
        images=images,
        barcode=barcode,
        source_url=url,
        source_domain=domain,
        brand=brand,
        slug=slug,
        raw=raw,
    )


def _extract_shopify_embedded_json(html: str) -> Optional[Dict[str, Any]]:
    patterns = [
        r"ShopifyAnalytics\.meta\s*=\s*(\{.*?\});\s*",
        r'type="application/json"\s*data-product-json[^>]*>(\{.*?\})<',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.DOTALL)
        if not match:
            continue
        try:
            data = json.loads(match.group(1))
            if isinstance(data, dict) and isinstance(data.get("product"), dict):
                return data["product"]
            if isinstance(data, dict) and data.get("variants"):
                return data
        except json.JSONDecodeError:
            continue

    soup = BeautifulSoup(html, "lxml")
    for script in soup.find_all("script", type="application/json"):
        text = (script.string or "").strip()
        if not text or "variants" not in text:
            continue
        try:
            data = json.loads(text)
            if isinstance(data, dict) and (data.get("variants") or data.get("title")):
                return data
        except json.JSONDecodeError:
            continue
    return None


def extract_from_candidate(candidate: SearchCandidate, profile: Dict[str, Any]) -> UnifiedProduct:
    return extract_from_url(candidate.url, profile)
