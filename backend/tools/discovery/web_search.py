"""Site-restricted web search fallback for discovery (Google CSE, Brave, DuckDuckGo).

Uses proactive sleep between requests and exponential backoff when a provider
returns rate-limit / ban signals.
"""

from __future__ import annotations

import json
import os
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from tools.discovery.extractors.base import SearchCandidate

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_BAN_STATUS = {403, 429, 503}
_BAN_BODY_HINTS = (
    "captcha",
    "unusual traffic",
    "automated queries",
    "rate limit",
    "too many requests",
    "blocked",
    "verify you are human",
)


@dataclass
class _ProviderState:
    last_request_at: float = 0.0
    ban_until: float = 0.0
    consecutive_bans: int = 0


_PROVIDER_STATES: Dict[str, _ProviderState] = {}


def _provider_state(name: str) -> _ProviderState:
    if name not in _PROVIDER_STATES:
        _PROVIDER_STATES[name] = _ProviderState()
    return _PROVIDER_STATES[name]


def _fallback_cfg(profile: Dict[str, Any]) -> Dict[str, Any]:
    search_cfg = profile.get("search_config") or {}
    fb = search_cfg.get("fallback") or {}
    if isinstance(fb, bool):
        fb = {"enabled": fb}
    defaults = {
        "enabled": os.environ.get("DISCOVERY_WEB_SEARCH_FALLBACK", "true").lower() != "false",
        "providers": _default_providers(),
        "sleep_seconds": float(os.environ.get("DISCOVERY_WEB_SEARCH_SLEEP_SECONDS", "2.5")),
        "ban_sleep_seconds": float(os.environ.get("DISCOVERY_WEB_SEARCH_BAN_SLEEP_SECONDS", "90")),
        "max_ban_sleep_seconds": float(os.environ.get("DISCOVERY_WEB_SEARCH_MAX_BAN_SLEEP_SECONDS", "600")),
        "max_retries": int(os.environ.get("DISCOVERY_WEB_SEARCH_MAX_RETRIES", "2")),
    }
    merged = {**defaults, **fb}
    providers = merged.get("providers")
    if isinstance(providers, str):
        merged["providers"] = [p.strip() for p in providers.split(",") if p.strip()]
    return merged


def _default_providers() -> List[str]:
    raw = os.environ.get("DISCOVERY_WEB_SEARCH_PROVIDERS", "google_cse,brave,duckduckgo")
    return [p.strip() for p in raw.split(",") if p.strip()]


def fallback_enabled(profile: Dict[str, Any]) -> bool:
    cfg = _fallback_cfg(profile)
    return bool(cfg.get("enabled"))


def _sleep_proactive(provider: str, cfg: Dict[str, Any]) -> None:
    state = _provider_state(provider)
    now = time.time()

    if now < state.ban_until:
        wait = state.ban_until - now
        time.sleep(wait)

    interval = float(cfg.get("sleep_seconds") or 2.5)
    since_last = time.time() - state.last_request_at
    if state.last_request_at and since_last < interval:
        jitter = random.uniform(0.0, min(0.75, interval * 0.2))
        time.sleep(interval - since_last + jitter)

    state.last_request_at = time.time()


def _mark_ban(provider: str, cfg: Dict[str, Any]) -> float:
    state = _provider_state(provider)
    state.consecutive_bans += 1
    base = float(cfg.get("ban_sleep_seconds") or 90)
    cap = float(cfg.get("max_ban_sleep_seconds") or 600)
    wait = min(base * (2 ** max(state.consecutive_bans - 1, 0)), cap)
    state.ban_until = time.time() + wait
    return wait


def _mark_success(provider: str) -> None:
    state = _provider_state(provider)
    state.consecutive_bans = 0
    state.ban_until = 0.0


def _looks_banned(status: int, body: str) -> bool:
    if status in _BAN_STATUS:
        return True
    lower = (body or "").lower()
    return any(hint in lower for hint in _BAN_BODY_HINTS)


def _http_get(url: str, headers: Optional[Dict[str, str]] = None, timeout: int = 25) -> tuple[int, str]:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, **(headers or {})},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace") if exc.fp else ""
        return exc.code, body


def _site_query(domain: str, query: str) -> str:
    clean_domain = domain.lower().removeprefix("www.")
    clean_query = re.sub(r"\s+", " ", (query or "").strip())
    return f"site:{clean_domain} {clean_query}".strip()


def _link_patterns(profile: Dict[str, Any]) -> List[str]:
    search_cfg = profile.get("search_config") or {}
    return search_cfg.get("link_patterns") or [
        r"/products/",
        r"/product/",
        r"med\.php",
    ]


def _url_matches_patterns(url: str, patterns: List[str]) -> bool:
    return any(re.search(pat, url, re.I) for pat in patterns)


def _normalize_result_url(url: str, domain: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower().removeprefix("www.")
    target = domain.lower().removeprefix("www.")
    if host and host != target and not host.endswith("." + target):
        return ""
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return f"https://{domain}{url}"
    return url


def _to_candidates(
    hits: List[Dict[str, str]],
    *,
    domain: str,
    patterns: List[str],
    provider: str,
    limit: int = 10,
) -> List[SearchCandidate]:
    out: List[SearchCandidate] = []
    seen = set()
    for hit in hits:
        url = _normalize_result_url(hit.get("url") or "", domain)
        title = (hit.get("title") or "").strip()
        if not url or url in seen:
            continue
        if not _url_matches_patterns(url, patterns):
            continue
        seen.add(url)
        out.append(
            SearchCandidate(
                title=title or url,
                url=url,
                raw={"provider": provider, "search_fallback": True},
            )
        )
        if len(out) >= limit:
            break
    return out


def _search_google_cse(site_q: str, cfg: Dict[str, Any]) -> List[Dict[str, str]]:
    api_key = os.environ.get("GOOGLE_CSE_API_KEY", "").strip()
    cx = os.environ.get("GOOGLE_CSE_CX", "").strip()
    if not api_key or not cx:
        return []

    params = urllib.parse.urlencode({"key": api_key, "cx": cx, "q": site_q, "num": 10})
    status, body = _http_get(f"https://www.googleapis.com/customsearch/v1?{params}")
    if _looks_banned(status, body):
        raise RuntimeError(f"google_cse banned status={status}")

    data = json.loads(body or "{}")
    if data.get("error"):
        err = data["error"]
        code = err.get("code", status)
        if code in _BAN_STATUS or "quota" in json.dumps(err).lower():
            raise RuntimeError(f"google_cse error: {err.get('message', err)}")
        return []

    hits = []
    for item in data.get("items") or []:
        hits.append({"url": item.get("link") or "", "title": item.get("title") or ""})
    return hits


def _search_brave(site_q: str, cfg: Dict[str, Any]) -> List[Dict[str, str]]:
    api_key = os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()
    if not api_key:
        return []

    params = urllib.parse.urlencode({"q": site_q, "count": 10})
    status, body = _http_get(
        f"https://api.search.brave.com/res/v1/web/search?{params}",
        headers={"Accept": "application/json", "X-Subscription-Token": api_key},
    )
    if _looks_banned(status, body):
        raise RuntimeError(f"brave banned status={status}")

    data = json.loads(body or "{}")
    hits = []
    for item in (data.get("web") or {}).get("results") or []:
        hits.append({"url": item.get("url") or "", "title": item.get("title") or ""})
    return hits


def _search_duckduckgo(site_q: str, cfg: Dict[str, Any]) -> List[Dict[str, str]]:
    params = urllib.parse.urlencode({"q": site_q})
    status, body = _http_get(f"https://html.duckduckgo.com/html/?{params}")
    if _looks_banned(status, body):
        raise RuntimeError(f"duckduckgo banned status={status}")

    soup = BeautifulSoup(body or "", "lxml")
    hits = []
    for block in soup.select(".result, .web-result"):
        link = block.select_one("a.result__a, a.result-link")
        if not link:
            continue
        href = link.get("href") or ""
        if "uddg=" in href:
            parsed = urllib.parse.parse_qs(urlparse(href).query)
            href = urllib.parse.unquote(parsed.get("uddg", [href])[0])
        title = link.get_text(" ", strip=True)
        if href:
            hits.append({"url": href, "title": title})
    return hits


_PROVIDER_FN = {
    "google_cse": _search_google_cse,
    "brave": _search_brave,
    "duckduckgo": _search_duckduckgo,
}


def _run_provider(provider: str, site_q: str, cfg: Dict[str, Any]) -> List[Dict[str, str]]:
    fn = _PROVIDER_FN.get(provider)
    if not fn:
        return []
    _sleep_proactive(provider, cfg)
    return fn(site_q, cfg)


def web_search_site(query: str, profile: Dict[str, Any]) -> List[SearchCandidate]:
    """Try configured web search providers until one returns product-like URLs."""
    cfg = _fallback_cfg(profile)
    if not cfg.get("enabled"):
        return []

    domain = profile.get("domain") or ""
    if not domain:
        return []

    site_q = _site_query(domain, query)
    patterns = _link_patterns(profile)
    providers = cfg.get("providers") or _default_providers()
    max_retries = int(cfg.get("max_retries") or 2)

    errors: List[str] = []
    for provider in providers:
        if provider not in _PROVIDER_FN:
            continue
        for attempt in range(max_retries + 1):
            try:
                hits = _run_provider(provider, site_q, cfg)
                candidates = _to_candidates(
                    hits,
                    domain=domain,
                    patterns=patterns,
                    provider=provider,
                )
                if candidates:
                    _mark_success(provider)
                    return candidates
                if hits:
                    # Provider returned links but none matched product patterns.
                    break
                break
            except Exception as exc:
                wait = _mark_ban(provider, cfg)
                errors.append(f"{provider}: {exc} (sleep {wait:.0f}s)")
                if attempt < max_retries:
                    time.sleep(wait)
                    continue
                break

    return []


def provider_status() -> Dict[str, Any]:
    """Expose throttle/ban state for debugging."""
    now = time.time()
    out = {}
    for name, state in _PROVIDER_STATES.items():
        out[name] = {
            "consecutive_bans": state.consecutive_bans,
            "ban_seconds_remaining": max(0.0, state.ban_until - now),
            "seconds_since_last_request": max(0.0, now - state.last_request_at) if state.last_request_at else None,
        }
    return out
