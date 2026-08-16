"""Custom CSS-selector based discovery extractor."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from tools.discovery.extractors.base import SearchCandidate, UnifiedProduct
from tools.discovery.html_fetcher import fetch_html
from tools.discovery.platform_detect import domain_from_url


def _first_text(soup: BeautifulSoup, selector: Optional[str]) -> str:
    if not selector:
        return ""
    el = soup.select_one(selector)
    return el.get_text(strip=True) if el else ""


def _first_attr(soup: BeautifulSoup, selector: Optional[str], attr: str = "src") -> str:
    if not selector:
        return ""
    el = soup.select_one(selector)
    if not el:
        return ""
    return el.get(attr) or el.get("data-src") or el.get("content") or ""


def _parse_price_text(text: str, divisor: float = 1.0) -> Optional[float]:
    if not text:
        return None
    cleaned = re.sub(r"[^\d.]", "", text.replace(",", ""))
    if not cleaned:
        return None
    try:
        val = float(cleaned)
        if divisor > 1 and val >= 100:
            return round(val / divisor, 2)
        return round(val, 2)
    except ValueError:
        return None


def extract_with_config(
    html: str,
    url: str,
    domain: str,
    base: str,
    extract_cfg: Dict[str, Any],
) -> UnifiedProduct:
    soup = BeautifulSoup(html or "", "lxml")
    divisor = float(extract_cfg.get("price_divisor") or 1)
    name = _first_text(soup, extract_cfg.get("name") or "h1")
    price_text = _first_text(soup, extract_cfg.get("price"))
    if not price_text:
        price_text = _first_attr(soup, extract_cfg.get("price"), "content")
    price = _parse_price_text(price_text, divisor=divisor)

    image = _first_attr(soup, extract_cfg.get("image"), "src")
    if image and not image.startswith("http"):
        image = urljoin(base, image)

    barcode = _first_text(soup, extract_cfg.get("barcode"))
    if not barcode:
        barcode = _first_attr(soup, extract_cfg.get("barcode"), "content")

    return UnifiedProduct(
        title_en=name,
        price=price,
        image_url=image,
        images=[image] if image else [],
        barcode=barcode,
        source_url=url,
        source_domain=domain,
        raw={"html_length": len(html or "")},
    )


def search(query: str, profile: Dict[str, Any]) -> List[SearchCandidate]:
    domain = profile.get("domain") or ""
    search_cfg = profile.get("search_config") or {}
    base = f"https://{domain}"
    search_type = search_cfg.get("type") or "url_template"

    if search_type == "shopify_suggest":
        from tools.discovery.extractors import shopify

        return shopify.search(query, profile)

    template = search_cfg.get("template") or f"https://{domain}/search?q={{query}}"
    from urllib.parse import quote

    search_url = template.format(domain=domain, query=quote(query))
    html = fetch_html(search_url)
    soup = BeautifulSoup(html or "", "lxml")
    candidates = []
    for a in soup.select("a[href]")[:30]:
        href = a.get("href") or ""
        title = a.get_text(strip=True)
        if not title or len(title) < 3:
            continue
        if "/product" in href.lower() or "/products/" in href.lower() or query.lower()[:4] in title.lower():
            full_url = href if href.startswith("http") else urljoin(base, href)
            candidates.append(SearchCandidate(title=title, url=full_url, raw={"href": href}))
        if len(candidates) >= 10:
            break
    return candidates


def extract_from_url(url: str, profile: Dict[str, Any]) -> UnifiedProduct:
    domain = profile.get("domain") or domain_from_url(url)
    base = f"https://{domain}"
    html = fetch_html(url)
    extract_cfg = profile.get("extract_config") or {}
    return extract_with_config(html, url, domain, base, extract_cfg)


def extract_from_candidate(candidate: SearchCandidate, profile: Dict[str, Any]) -> UnifiedProduct:
    return extract_from_url(candidate.url, profile)
