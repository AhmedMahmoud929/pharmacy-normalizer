"""Background runner for product discovery jobs."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import sys
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
from urllib.parse import unquote, urlparse

import pandas as pd

tools_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(tools_dir)
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer import normalize
from tools.csv_helper import load_sheet_safely
from tools.discovery.extractors.registry import (
    extract_from_candidate,
    extract_product,
    search_products,
)
from tools.discovery.platform_detect import domain_from_url
from tools.discovery_db import (
    finalize_job,
    get_job,
    save_results,
    update_job_pid,
    update_job_progress,
    recount_stats,
    update_job_counts,
)
from tools.matcher import NAME_COLUMN_CANDIDATES, score_match_detailed
from tools.source_profiles_repo import list_profiles

job_listeners: Dict[str, Set[asyncio.Queue]] = {}

MATCHER_JOBS_DIR = os.path.join(project_root, "data", "matcher", "jobs")  # legacy uploads only


def detect_column(columns: List[str], candidates: List[str], *, fuzzy_tokens: Optional[List[str]] = None) -> Optional[str]:
    col_set = {str(c): str(c) for c in columns}
    for candidate in candidates:
        if candidate in col_set:
            return col_set[candidate]
    lower_map = {str(c).lower().strip(): str(c) for c in columns}
    for candidate in candidates:
        key = candidate.lower().strip()
        if key in lower_map:
            return lower_map[key]
    if fuzzy_tokens:
        for col in columns:
            col_lower = str(col).lower()
            if any(tok in col_lower for tok in fuzzy_tokens):
                return str(col)
    return None


async def _broadcast(job_id: str, event: str, data: dict) -> None:
    if job_id not in job_listeners:
        return
    payload = json.dumps(data, ensure_ascii=False)
    msg = f"event: {event}\ndata: {payload}\n\n"
    for q in list(job_listeners.get(job_id, set())):
        await q.put(msg)


def _top_match_status(item: dict) -> str:
    matches = item.get("matches") or []
    if not matches:
        return "no_match"
    return matches[0].get("status") or "no_match"


def load_matcher_no_match_rows(matcher_job_id: str) -> List[Dict[str, Any]]:
    from tools.matcher_db import load_results

    try:
        data = load_results(matcher_job_id)
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Matcher results not found for job {matcher_job_id}") from exc
    rows = []
    for item in data:
        if _top_match_status(item) != "no_match":
            continue
        rows.append(
            {
                "original_name": item.get("original_name") or "",
                "normalized_name": item.get("normalized_name") or "",
            }
        )
    return rows


def load_upload_rows(file_bytes: bytes, file_ext: str, name_column: Optional[str]) -> List[Dict[str, Any]]:
    df = load_sheet_safely(file_bytes, file_ext)
    col = name_column or detect_column(
        [str(c) for c in df.columns],
        NAME_COLUMN_CANDIDATES,
        fuzzy_tokens=["name", "product", "اسم"],
    )
    if not col:
        raise ValueError("Could not detect name column in uploaded file")
    rows = []
    for _, series in df.iterrows():
        val = series.get(col)
        if pd.isna(val):
            continue
        original = str(val).strip()
        if not original:
            continue
        rows.append(
            {
                "original_name": original,
                "normalized_name": normalize(original),
            }
        )
    return rows


def _resolve_profiles(source_domains: Optional[List[str]]) -> List[Dict[str, Any]]:
    all_profiles = list_profiles(enabled_only=True)
    if source_domains:
        allowed = {d.lower() for d in source_domains}
        return [p for p in all_profiles if p.get("domain", "").lower() in allowed]
    return all_profiles


def _score_product(query_norm: str, product_title: str) -> float:
    cand_norm = normalize(product_title) if product_title else ""
    details = score_match_detailed(query_norm, cand_norm)
    return float(details.get("score") or 0.0)


def _classify_status(score: float, match_threshold: float, review_threshold: float) -> str:
    if score >= match_threshold:
        return "found"
    if score >= review_threshold:
        return "review"
    return "not_found"


def _looks_like_product_url(text: str) -> bool:
    value = (text or "").strip().lower()
    if value.startswith("http://") or value.startswith("https://"):
        return True
    return bool(re.match(r"^[\w.-]+\.(com|eg|net|org|shop)/", value))


def _normalize_product_url(text: str) -> str:
    value = text.strip()
    if not value.startswith("http"):
        return "https://" + value
    return value


def _domain_matches(profile_domain: str, url_domain: str) -> bool:
    profile = (profile_domain or "").lower().removeprefix("www.")
    host = (url_domain or "").lower().removeprefix("www.")
    return profile == host or host.endswith("." + profile)


def _search_query_from_input(text: str) -> Tuple[str, str, Optional[str]]:
    """Return (original input, search query, direct URL if input is a product link)."""
    original = (text or "").strip()
    if not _looks_like_product_url(original):
        return original, original, None

    url = _normalize_product_url(original)
    path = unquote(urlparse(url).path or "")
    slug = path.rstrip("/").split("/")[-1] if path else ""
    slug = re.sub(r"-\d{4,}$", "", slug)

    latin_parts: List[str] = []
    for part in re.split(r"[-_%]+", slug):
        part = part.strip()
        if not part or re.fullmatch(r"\d+", part):
            continue
        if re.search(r"[\u0600-\u06FF]", part):
            continue
        latin_parts.append(part)

    search_query = " ".join(latin_parts)
    if not search_query or len(search_query) < 3:
        search_query = re.sub(r"[-_]+", " ", slug)
        search_query = re.sub(r"[\u0600-\u06FF]+", " ", search_query)

    search_query = re.sub(r"\s+", " ", search_query).strip()
    return original, search_query or original, url


def _resolve_discovery_input(query_name: str, query_norm: str) -> Tuple[str, str, str, Optional[str]]:
    """Return (original, search_query, score_norm, direct_url)."""
    original, search_query, direct_url = _search_query_from_input(query_name)
    score_norm = normalize(search_query) if direct_url else query_norm
    return original, search_query, score_norm, direct_url


def _emit_step(
    on_step: Optional[Callable[[str, Dict[str, Any]], None]],
    phase: str,
    **data: Any,
) -> None:
    if on_step:
        on_step(phase, data)


def _discover_for_row(
    query_name: str,
    query_norm: str,
    profiles: List[Dict[str, Any]],
    match_threshold: float,
    review_threshold: float,
    on_step: Optional[Callable[[str, Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    best_result = None
    best_score = 0.0
    all_candidates = []

    original_input, search_query, score_norm, direct_url = _resolve_discovery_input(
        query_name, query_norm
    )
    url_domain = domain_from_url(direct_url) if direct_url else ""

    init_data: Dict[str, Any] = {
        "query_name": original_input,
        "query_norm": score_norm,
        "source_count": len(profiles),
        "sources": [
            {
                "domain": p.get("domain") or "",
                "platform": p.get("platform") or "custom",
                "display_name": p.get("display_name") or p.get("domain") or "",
            }
            for p in profiles
        ],
    }
    if direct_url:
        init_data["direct_url"] = direct_url
        init_data["search_query"] = search_query
    _emit_step(on_step, "init", **init_data)

    for profile in profiles:
        domain = profile.get("domain") or ""
        platform = profile.get("platform") or "custom"

        if direct_url and _domain_matches(domain, url_domain):
            _emit_step(
                on_step,
                "direct_extract",
                domain=domain,
                platform=platform,
                url=direct_url,
            )
            try:
                product = extract_product(direct_url, profile)
            except Exception as exc:
                _emit_step(on_step, "extract_error", domain=domain, url=direct_url, error=str(exc))
                all_candidates.append({"source_domain": domain, "error": str(exc)})
                continue

            title = product.title_en or product.title_ar or ""
            score = _score_product(score_norm, title)
            status = _classify_status(score, match_threshold, review_threshold)
            entry = {
                "source_domain": domain,
                "source_url": product.source_url or direct_url,
                "title_en": product.title_en,
                "title_ar": product.title_ar,
                "price": product.price,
                "image_url": product.image_url,
                "barcode": product.barcode,
                "brand": product.brand,
                "score": round(score, 4),
                "raw": product.raw,
            }
            all_candidates.append(entry)
            _emit_step(
                on_step,
                "extract_done",
                domain=domain,
                url=entry["source_url"],
                title_en=entry["title_en"],
                title_ar=entry["title_ar"],
                price=entry["price"],
                image_url=entry["image_url"],
                brand=entry["brand"],
                score=entry["score"],
                status=status,
                direct=True,
            )
            if score > best_score:
                best_score = score
                best_result = entry
            if status == "found":
                _emit_step(on_step, "early_exit", domain=domain, score=score, reason="match_threshold_met")
                break
            continue

        _emit_step(
            on_step,
            "search_start",
            domain=domain,
            platform=platform,
            query=search_query,
        )
        try:
            candidates = search_products(search_query, profile)
        except Exception as exc:
            _emit_step(on_step, "search_error", domain=domain, error=str(exc))
            all_candidates.append(
                {
                    "source_domain": domain,
                    "error": str(exc),
                }
            )
            continue

        _emit_step(
            on_step,
            "search_done",
            domain=domain,
            count=len(candidates),
            candidates=[
                {"title": cand.title, "url": cand.url}
                for cand in candidates[:5]
            ],
        )

        for cand in candidates[:5]:
            _emit_step(
                on_step,
                "extract_start",
                domain=domain,
                url=cand.url,
                title=cand.title,
            )
            try:
                product = extract_from_candidate(cand, profile)
            except Exception as exc:
                _emit_step(
                    on_step,
                    "extract_error",
                    domain=domain,
                    url=cand.url,
                    error=str(exc),
                )
                all_candidates.append(
                    {
                        "source_domain": domain,
                        "title": cand.title,
                        "url": cand.url,
                        "error": str(exc),
                    }
                )
                continue

            title = product.title_en or product.title_ar or cand.title
            score = _score_product(score_norm, title)
            status = _classify_status(score, match_threshold, review_threshold)
            entry = {
                "source_domain": domain,
                "source_url": product.source_url or cand.url,
                "title_en": product.title_en,
                "title_ar": product.title_ar,
                "price": product.price,
                "image_url": product.image_url,
                "barcode": product.barcode,
                "brand": product.brand,
                "score": round(score, 4),
                "raw": product.raw,
            }
            all_candidates.append(entry)
            _emit_step(
                on_step,
                "extract_done",
                domain=domain,
                url=entry["source_url"],
                title_en=entry["title_en"],
                title_ar=entry["title_ar"],
                price=entry["price"],
                image_url=entry["image_url"],
                brand=entry["brand"],
                score=entry["score"],
                status=status,
            )

            if score > best_score:
                best_score = score
                best_result = entry
                _emit_step(
                    on_step,
                    "best_update",
                    domain=domain,
                    score=entry["score"],
                    status=status,
                    title_en=entry["title_en"],
                )

            if status == "found":
                _emit_step(
                    on_step,
                    "early_exit",
                    domain=domain,
                    score=score,
                    reason="match_threshold_met",
                )
                break

        if best_result and best_score >= match_threshold:
            break

    discovery_status = _classify_status(best_score, match_threshold, review_threshold)
    if not best_result:
        discovery_status = "not_found"

    return {
        "discovery_status": discovery_status,
        "score": best_score,
        "source_domain": (best_result or {}).get("source_domain"),
        "source_url": (best_result or {}).get("source_url"),
        "title_en": (best_result or {}).get("title_en"),
        "title_ar": (best_result or {}).get("title_ar"),
        "price": (best_result or {}).get("price"),
        "image_url": (best_result or {}).get("image_url"),
        "barcode": (best_result or {}).get("barcode"),
        "brand": (best_result or {}).get("brand"),
        "candidates": sorted(all_candidates, key=lambda x: x.get("score") or 0, reverse=True)[:10],
        "import_status": "pending",
    }


def discovery_product_to_catalog(row: Dict[str, Any], source_domain: str) -> Dict[str, Any]:
    title_en = row.get("title_en") or row.get("original_name") or ""
    slug_base = title_en.lower().replace(" ", "-")[:60]
    domain_part = (source_domain or "disc").replace(".", "-")
    digest = hashlib.md5(f"{source_domain}:{title_en}".encode()).hexdigest()[:10]
    product_id = f"disc-{domain_part}-{digest}"
    price = row.get("price")

    return {
        "id": product_id,
        "title_en": title_en,
        "title_ar": row.get("title_ar") or "",
        "normalized_name_en": normalize(title_en),
        "slug": f"{slug_base}-{digest}",
        "price": price,
        "final_price": price,
        "image": row.get("image_url") or "",
        "international_barcode": row.get("barcode") or "",
        "full_url": row.get("source_url") or "",
        "source": source_domain,
        "_source": source_domain,
        "in_stock": True,
        "brands": {"title_en": row.get("brand")} if row.get("brand") else None,
        "level_one_category": {"slug": "medications", "title_en": "Medications", "title_ar": "الأدوية"},
    }


async def run_discovery_background(
    job_id: str,
    *,
    input_type: str,
    matcher_job_id: Optional[str] = None,
    file_bytes: Optional[bytes] = None,
    file_ext: str = ".xlsx",
    name_column: Optional[str] = None,
    source_domains: Optional[List[str]] = None,
    match_threshold: float = 0.60,
    review_threshold: float = 0.40,
) -> None:
    import os

    pid = os.getpid()
    update_job_pid(job_id, pid)
    results: List[Dict[str, Any]] = []

    try:
        if input_type == "matcher":
            if not matcher_job_id:
                raise ValueError("matcher_job_id is required for matcher input")
            input_rows = load_matcher_no_match_rows(matcher_job_id)
        else:
            if not file_bytes:
                raise ValueError("file is required for upload input")
            input_rows = load_upload_rows(file_bytes, file_ext, name_column)

        profiles = _resolve_profiles(source_domains)
        if not profiles:
            raise ValueError("No enabled source profiles found")

        found_count = review_count = not_found_count = 0

        for idx, row in enumerate(input_rows):
            if idx % 3 == 0:
                current_job = get_job(job_id)
                if current_job and current_job.get("status") == "stopped":
                    save_results(job_id, results)
                    counts = recount_stats(results)
                    update_job_counts(job_id, **counts)
                    await _broadcast(job_id, "complete", {"status": "stopped", **counts})
                    return

            original = row.get("original_name") or ""
            norm = row.get("normalized_name") or normalize(original)
            discovered = _discover_for_row(
                original,
                norm,
                profiles,
                match_threshold,
                review_threshold,
            )
            result_row = {
                "row_index": idx,
                "original_name": original,
                "normalized_name": norm,
                **discovered,
            }
            results.append(result_row)

            status = result_row.get("discovery_status")
            if status == "found":
                found_count += 1
            elif status == "review":
                review_count += 1
            else:
                not_found_count += 1

            if (idx + 1) % 5 == 0 or idx + 1 == len(input_rows):
                update_job_progress(
                    job_id,
                    processed_rows=idx + 1,
                    found_count=found_count,
                    review_count=review_count,
                    not_found_count=not_found_count,
                )
                save_results(job_id, results)
                await _broadcast(
                    job_id,
                    "progress",
                    {
                        "processed": idx + 1,
                        "total": len(input_rows),
                        "found_count": found_count,
                        "review_count": review_count,
                        "not_found_count": not_found_count,
                    },
                )

        save_results(job_id, results)
        counts = recount_stats(results)
        update_job_counts(job_id, **counts)
        finalize_job(job_id, "completed")
        await _broadcast(job_id, "complete", {"status": "completed", **counts})

    except Exception as exc:
        if results:
            save_results(job_id, results)
        finalize_job(job_id, "failed", error_msg=str(exc))
        await _broadcast(job_id, "error", {"status": "failed", "error": str(exc)})


async def stream_discovery_try(
    product_name: str,
    *,
    source_domains: Optional[List[str]] = None,
    match_threshold: float = 0.60,
    review_threshold: float = 0.40,
):
    """Yield SSE frames for a single-product discovery dry run."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def on_step(phase: str, data: Dict[str, Any]) -> None:
        loop.call_soon_threadsafe(
            queue.put_nowait,
            ("step", {"phase": phase, **data}),
        )

    async def worker() -> None:
        try:
            name = (product_name or "").strip()
            if not name:
                raise ValueError("product_name is required")
            query_norm = normalize(name)
            profiles = _resolve_profiles(source_domains)
            if not profiles:
                raise ValueError("No enabled source profiles found")

            result = await asyncio.to_thread(
                _discover_for_row,
                name,
                query_norm,
                profiles,
                match_threshold,
                review_threshold,
                on_step,
            )
            await queue.put(
                (
                    "complete",
                    {
                        "original_name": name,
                        "normalized_name": query_norm,
                        **result,
                    },
                )
            )
        except Exception as exc:
            await queue.put(("error", {"error": str(exc)}))

    task = asyncio.create_task(worker())
    try:
        while True:
            event, data = await queue.get()
            payload = json.dumps(data, ensure_ascii=False)
            yield f"event: {event}\ndata: {payload}\n\n"
            if event in ("complete", "error"):
                break
    finally:
        await task
