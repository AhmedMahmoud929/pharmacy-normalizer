"""Background runner for product discovery jobs."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import sys
from typing import Any, Dict, List, Optional, Set

import pandas as pd

tools_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(tools_dir)
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer import normalize
from tools.csv_helper import load_sheet_safely
from tools.discovery.extractors.registry import (
    extract_from_candidate,
    search_products,
)
from tools.discovery_db import (
    finalize_job,
    save_results,
    update_job_pid,
    update_job_progress,
    recount_stats,
    update_job_counts,
)
from tools.matcher import NAME_COLUMN_CANDIDATES, score_match_detailed
from tools.source_profiles_repo import list_profiles

job_listeners: Dict[str, Set[asyncio.Queue]] = {}

MATCHER_JOBS_DIR = os.path.join(project_root, "data", "matcher", "jobs")


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
    results_path = os.path.join(MATCHER_JOBS_DIR, matcher_job_id, "results.json")
    if not os.path.exists(results_path):
        raise FileNotFoundError(f"Matcher results not found for job {matcher_job_id}")
    with open(results_path, "r", encoding="utf-8") as f:
        data = json.load(f)
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


def _discover_for_row(
    query_name: str,
    query_norm: str,
    profiles: List[Dict[str, Any]],
    match_threshold: float,
    review_threshold: float,
) -> Dict[str, Any]:
    best_result = None
    best_score = 0.0
    all_candidates = []

    for profile in profiles:
        domain = profile.get("domain") or ""
        try:
            candidates = search_products(query_name, profile)
        except Exception as exc:
            all_candidates.append(
                {
                    "source_domain": domain,
                    "error": str(exc),
                }
            )
            continue

        for cand in candidates[:5]:
            try:
                product = extract_from_candidate(cand, profile)
            except Exception as exc:
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
            score = _score_product(query_norm, title)
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

            if score > best_score:
                best_score = score
                best_result = entry

            status = _classify_status(score, match_threshold, review_threshold)
            if status == "found":
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
