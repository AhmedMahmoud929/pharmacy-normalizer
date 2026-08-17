"""Custom CSS-selector based discovery extractor with shared HTML heuristics."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, unquote, urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup

from tools.discovery.barcode_utils import (
    ld_json_barcode_candidates,
    normalize_international_barcode,
    pick_international_barcode,
)
from tools.discovery.extractors.base import SearchCandidate, UnifiedProduct
from tools.discovery.html_fetcher import fetch_html
from tools.discovery.platform_detect import domain_from_url

_BAD_IMAGE_KEYWORDS = (
    "logo",
    "placeholder",
    "icon",
    "badge",
    "authentic",
    "facebook.com/tr",
    "appstore",
    "googleplay",
    "circlemedhome",
    "search3d",
    "downloadicon",
    "piceincreaser",
    "database-storage",
    "onlineph",
    "favicon",
)
_SITE_TITLE_HINTS = (
    "price in egypt",
    "dawaa",
    "دواء",
    "closet",
    "source beauty",
    "powered by",
)
_TABLE_LABELS = {
    "title_en": ("الاسم التجاري", "trade name", "product name", "name"),
    "title_ar": ("الاسم العربي", "arabic name"),
    "price": ("السعر الحالي الجديد", "current price", "new price", "price"),
    "brand": ("الشركة المنتجة", "manufacturer", "brand", "company"),
    "barcode": ("رمز الباركود", "barcode", "ean", "gtin"),
}


def _has_arabic(text: str) -> bool:
    return bool(re.search(r"[\u0600-\u06FF]", text or ""))


def _has_latin(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]", text or ""))


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


def _meta(soup: BeautifulSoup, *keys: str) -> str:
    for key in keys:
        el = soup.select_one(f'meta[property="{key}"], meta[name="{key}"]')
        if el and el.get("content"):
            return el.get("content", "").strip()
    return ""


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


def _clean_title(text: str) -> str:
    value = re.sub(r"\s+", " ", (text or "").strip())
    value = re.sub(r"\s+price in egypt\s*$", "", value, flags=re.I)
    value = re.sub(r"^\s*سعر\s+", "", value)
    value = re.sub(r"\s+\d{4}\s+في\s+مصر\s*$", "", value)
    return value.strip(" -|,")


def _looks_like_site_title(text: str) -> bool:
    lower = (text or "").lower()
    if not text or len(text) < 4:
        return True
    if lower in {"language", "menu", "search", "home", "cart", "account"}:
        return True
    if "|" in text and len(text) > 60:
        return True
    return any(hint in lower for hint in _SITE_TITLE_HINTS)


def _text_from_selectors(soup: BeautifulSoup, selector: Optional[str]) -> str:
    if not selector:
        return ""
    for sel in [part.strip() for part in selector.split(",") if part.strip()]:
        text = _clean_title(_first_text(soup, sel))
        if text and not _looks_like_site_title(text):
            return text
    return ""


def _split_bilingual_text(text: str) -> Tuple[str, str]:
    cleaned = _clean_title(text)
    if not cleaned:
        return "", ""

    parts = [p.strip() for p in re.split(r"\s[-–|]\s+", cleaned) if p.strip()]
    if not parts:
        parts = [cleaned]

    ar_parts = [p for p in parts if _has_arabic(p)]
    en_parts = [p for p in parts if _has_latin(p) and not _has_arabic(p)]

    title_ar = _clean_title(ar_parts[0]) if ar_parts else ""
    title_en = _clean_title(en_parts[0]) if en_parts else ""
    if not title_en and not title_ar and cleaned:
        if _has_arabic(cleaned):
            title_ar = cleaned
        else:
            title_en = cleaned
    return title_en, title_ar


def _table_value(soup: BeautifulSoup, labels: Tuple[str, ...]) -> str:
    for tr in soup.select("table tr"):
        cells = tr.select("td, th")
        if len(cells) < 2:
            continue
        label = cells[0].get_text(" ", strip=True).lower()
        if any(l.lower() in label for l in labels):
            return cells[1].get_text(" ", strip=True)
    return ""


def _extract_ld_json(soup: BeautifulSoup) -> Dict[str, Any]:
    for script in soup.select('script[type="application/ld+json"]'):
        raw = (script.string or script.get_text() or "").strip()
        if not raw or "Product" not in raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("@type") == "Product" or "Product" in str(item.get("@type", "")):
                return item
            graph = item.get("@graph")
            if isinstance(graph, list):
                for node in graph:
                    if isinstance(node, dict) and (
                        node.get("@type") == "Product" or "Product" in str(node.get("@type", ""))
                    ):
                        return node
    return {}


def _ld_images(product: Dict[str, Any]) -> List[str]:
    image = product.get("image")
    if isinstance(image, str):
        return [image]
    if isinstance(image, list):
        return [str(x) for x in image if x]
    if isinstance(image, dict) and image.get("url"):
        return [str(image["url"])]
    return []


def _ld_price(product: Dict[str, Any]) -> Optional[float]:
    offers = product.get("offers")
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    if isinstance(offers, dict):
        for key in ("price", "lowPrice", "highPrice"):
            if offers.get(key) is not None:
                parsed = _parse_price_text(str(offers[key]))
                if parsed is not None:
                    return parsed
    return None


def _ld_brand(product: Dict[str, Any]) -> str:
    brand = product.get("brand")
    if isinstance(brand, dict):
        return str(brand.get("name") or "").strip()
    if isinstance(brand, str):
        return brand.strip()
    return ""


def _ld_name(product: Dict[str, Any]) -> str:
    name = str(product.get("name") or "").strip()
    if " by " in name:
        name = name.split(" by ", 1)[0].strip()
    if " | " in name:
        name = name.split(" | ", 1)[0].strip()
    return _clean_title(name)


def _is_bad_image(url: str) -> bool:
    lower = (url or "").lower()
    return not lower or any(token in lower for token in _BAD_IMAGE_KEYWORDS)


def _normalize_image(url: str, base: str) -> str:
    if not url:
        return ""
    if url.startswith("//"):
        return "https:" + url
    if not url.startswith("http"):
        return urljoin(base, url)
    return url


def _pick_image(soup: BeautifulSoup, base: str, selector: Optional[str]) -> str:
    if selector:
        candidate = _normalize_image(_first_attr(soup, selector, "src"), base)
        if candidate and not _is_bad_image(candidate):
            return candidate
        candidate = _normalize_image(_first_attr(soup, selector, "content"), base)
        if candidate and not _is_bad_image(candidate):
            return candidate

    for key in ("og:image:secure_url", "og:image", "twitter:image"):
        candidate = _normalize_image(_meta(soup, key), base)
        if candidate and not _is_bad_image(candidate):
            return candidate

    ld = _extract_ld_json(soup)
    for candidate in _ld_images(ld):
        candidate = _normalize_image(candidate, base)
        if candidate and not _is_bad_image(candidate):
            return candidate

    for img in soup.select("img[src], img[data-src]"):
        src = _normalize_image(img.get("src") or img.get("data-src") or "", base)
        if src and not _is_bad_image(src):
            return src
    return ""


def _pick_price(soup: BeautifulSoup, selector: Optional[str], divisor: float) -> Optional[float]:
    if selector:
        text = _first_text(soup, selector) or _first_attr(soup, selector, "content")
        parsed = _parse_price_text(text, divisor=divisor)
        if parsed is not None:
            return parsed

    for key in ("product:price:amount", "og:price:amount"):
        parsed = _parse_price_text(_meta(soup, key), divisor=divisor)
        if parsed is not None:
            return parsed

    for el in soup.select("[itemprop='price'], [itemprop='priceSpecification']"):
        parsed = _parse_price_text(
            el.get("content") or el.get_text(" ", strip=True),
            divisor=divisor,
        )
        if parsed is not None:
            return parsed

    ld = _extract_ld_json(soup)
    parsed = _ld_price(ld)
    if parsed is not None:
        return parsed

    table_price = _table_value(soup, _TABLE_LABELS["price"])
    parsed = _parse_price_text(table_price, divisor=divisor)
    if parsed is not None:
        return parsed

    for el in soup.select("strong, b, span, div, p"):
        text = el.get_text(" ", strip=True)
        if re.search(r"(?:ج\.?\s*م|EGP|جنيه)", text, re.I):
            parsed = _parse_price_text(text, divisor=divisor)
            if parsed is not None:
                return parsed
    return None


def _pick_titles(
    soup: BeautifulSoup,
    extract_cfg: Dict[str, Any],
) -> Tuple[str, str]:
    name_sel = extract_cfg.get("name")
    name_ar_sel = extract_cfg.get("name_ar")

    title_en = _text_from_selectors(soup, name_sel)
    title_ar = _text_from_selectors(soup, name_ar_sel)

    h1 = _clean_title(_first_text(soup, "h1"))
    h2 = _clean_title(_first_text(soup, "h2"))

    if not title_en:
        if h1 and not _looks_like_site_title(h1):
            title_en = h1
        elif h2 and _has_latin(h2) and not _has_arabic(h2):
            title_en = h2

    if not title_ar:
        if h2 and _has_arabic(h2):
            title_ar = h2
        elif h1 and _has_arabic(h1):
            title_ar = h1

    table_en = _table_value(soup, _TABLE_LABELS["title_en"])
    table_ar = _table_value(soup, _TABLE_LABELS["title_ar"])
    if table_en:
        title_en = _clean_title(table_en)
    if table_ar:
        title_ar = _clean_title(table_ar)

    og_en, og_ar = _split_bilingual_text(_meta(soup, "og:title"))
    if not title_en and og_en:
        title_en = og_en
    if not title_ar and og_ar:
        title_ar = og_ar

    ld = _extract_ld_json(soup)
    ld_name = _ld_name(ld)
    if ld_name:
        if _has_arabic(ld_name) and not title_ar:
            title_ar = ld_name
        elif not title_en:
            title_en = ld_name

    if title_en and _looks_like_site_title(title_en) and title_ar:
        title_en = ""

    if title_en and title_ar and title_en == title_ar:
        if _has_arabic(title_en) and not _has_latin(title_en):
            title_en = ""
        elif _has_latin(title_ar) and not _has_arabic(title_ar):
            title_ar = ""

    return title_en, title_ar


def _pick_brand(soup: BeautifulSoup, selector: Optional[str]) -> str:
    if selector:
        value = _first_text(soup, selector)
        if value:
            return value

    table_brand = _table_value(soup, _TABLE_LABELS["brand"])
    if table_brand:
        return table_brand

    ld = _extract_ld_json(soup)
    brand = _ld_brand(ld)
    if brand:
        return brand

    for el in soup.select("a[href*='brand'], .brand, [class*='brand']"):
        text = el.get_text(" ", strip=True)
        if text and text.lower() not in {"brand", "brands", "جميع البرندات", "all brands"}:
            return text
    return ""


def _pick_barcode(soup: BeautifulSoup, selector: Optional[str]) -> str:
    candidates: List[Any] = []
    if selector:
        value = _first_text(soup, selector) or _first_attr(soup, selector, "content")
        if value:
            candidates.append(value.strip())
    table_barcode = _table_value(soup, _TABLE_LABELS["barcode"])
    if table_barcode:
        candidates.append(table_barcode.strip())

    ld = _extract_ld_json(soup)
    candidates.extend(ld_json_barcode_candidates(ld))

    return pick_international_barcode(*candidates)


def extract_with_config(
    html: str,
    url: str,
    domain: str,
    base: str,
    extract_cfg: Dict[str, Any],
) -> UnifiedProduct:
    soup = BeautifulSoup(html or "", "lxml")
    divisor = float(extract_cfg.get("price_divisor") or 1)

    title_en, title_ar = _pick_titles(soup, extract_cfg)
    price = _pick_price(soup, extract_cfg.get("price"), divisor)
    image = _pick_image(soup, base, extract_cfg.get("image"))
    barcode = _pick_barcode(soup, extract_cfg.get("barcode"))
    brand = _pick_brand(soup, extract_cfg.get("brand"))

    slug_match = re.search(r"/(?:products?|med\.php\?id=)([^/?#]+)", url or "")
    slug = slug_match.group(1) if slug_match else ""

    return UnifiedProduct(
        title_en=title_en,
        title_ar=title_ar,
        price=price,
        image_url=image,
        images=[image] if image else [],
        barcode=barcode,
        source_url=url,
        source_domain=domain,
        brand=brand,
        slug=slug,
        raw={"html_length": len(html or ""), "heuristics": True},
    )


def _encode_url_path(url: str) -> str:
    parsed = urlparse(url)
    if not (parsed.scheme and parsed.netloc):
        return url
    try:
        url.encode("ascii")
        return url
    except UnicodeEncodeError:
        path = quote(unquote(parsed.path), safe="/:@!$&'()*+,;=-._~")
        return urlunparse(parsed._replace(path=path))


def _absolute_url(base: str, href: str) -> str:
    full = href if href.startswith("http") else urljoin(base, href)
    return _encode_url_path(full)


def _link_relevance(query: str, href: str, title: str) -> int:
    words = [w for w in re.split(r"\W+", query.lower()) if len(w) >= 3]
    hay = f"{href} {title}".lower()
    return sum(1 for word in words if word in hay)


def _should_skip_link(href: str, exclude_patterns: List[str]) -> bool:
    for pattern in exclude_patterns:
        if re.search(pattern, href, re.I):
            return True
    return False


def search(query: str, profile: Dict[str, Any]) -> List[SearchCandidate]:
    domain = profile.get("domain") or ""
    search_cfg = profile.get("search_config") or {}
    sample_url = profile.get("sample_url") or ""
    if sample_url.startswith("http"):
        base = f"{urlparse(sample_url).scheme}://{urlparse(sample_url).netloc}"
    else:
        base = f"https://{domain}"
    search_type = search_cfg.get("type") or "url_template"

    if search_type == "shopify_suggest":
        from tools.discovery.extractors import shopify

        return shopify.search(query, profile)

    template = search_cfg.get("template") or f"https://{domain}/search?q={{query}}"
    search_url = template.format(domain=domain, query=quote(query))
    html = fetch_html(search_url)
    soup = BeautifulSoup(html or "", "lxml")

    patterns = search_cfg.get("link_patterns") or [
        r"/products/",
        r"/product/",
        r"/shop/[^/?#]+",
        r"med\.php",
    ]
    exclude_patterns = search_cfg.get("exclude_link_patterns") or [
        r"/shop/category/",
        r"\?search=",
        r"\?order=",
        r"/category/",
    ]
    pattern_re = re.compile("|".join(f"(?:{p})" for p in patterns), re.I)

    scored: List[Tuple[int, SearchCandidate]] = []
    seen_urls = set()
    query_hint = query.lower()[:4]

    for a in soup.select("a[href]"):
        href = a.get("href") or ""
        title = a.get_text(" ", strip=True)
        if not title or len(title) < 3:
            continue
        if _should_skip_link(href, exclude_patterns):
            continue
        if not pattern_re.search(href):
            if not query_hint or query_hint not in title.lower():
                continue
        full_url = _absolute_url(base, href)
        if full_url in seen_urls:
            continue
        if _should_skip_link(full_url, exclude_patterns):
            continue
        seen_urls.add(full_url)
        relevance = _link_relevance(query, href, title)
        scored.append(
            (
                relevance,
                SearchCandidate(title=title, url=full_url, raw={"href": href, "relevance": relevance}),
            )
        )

    scored.sort(key=lambda item: item[0], reverse=True)
    return [cand for _, cand in scored[:10]]


def extract_from_url(url: str, profile: Dict[str, Any]) -> UnifiedProduct:
    domain = profile.get("domain") or domain_from_url(url)
    base = f"https://{domain}"
    html = fetch_html(_encode_url_path(url))
    extract_cfg = profile.get("extract_config") or {}
    return extract_with_config(html, url, domain, base, extract_cfg)


def extract_from_candidate(candidate: SearchCandidate, profile: Dict[str, Any]) -> UnifiedProduct:
    return extract_from_url(candidate.url, profile)
