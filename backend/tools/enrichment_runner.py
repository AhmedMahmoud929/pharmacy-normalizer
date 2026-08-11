"""Barcode enrichment: match sheet rows to catalog products and classify for apply/review."""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional, Set

import pandas as pd

tools_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(tools_dir)
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer import normalize
from tools.csv_helper import load_sheet_safely
from tools.enrichment_db import (
    finalize_job,
    save_results,
    update_job_pid,
    update_job_progress,
    recount_stats,
    update_job_counts,
)
from tools.matcher import NAME_COLUMN_CANDIDATES, ProductIndex, normalize_lookup_key

job_listeners: Dict[str, Set[asyncio.Queue]] = {}

BARCODE_COLUMN_CANDIDATES = [
    "internationalBarcode",
    "international_barcode",
    "International Barcode",
    "barcode",
    "Barcode",
    "BARCODE",
    "ean",
    "EAN",
    "upc",
    "UPC",
    "gtin",
    "GTIN",
    "باركود",
    "الباركود",
    "الباركود الدولي",
]

CODE_COLUMN_CANDIDATES = [
    "code",
    "Code",
    "CODE",
    "pos_code",
    "POS Code",
    "sku",
    "SKU",
    "كود",
    "الكود",
]


def _extract_cell_string(val) -> Optional[str]:
    if pd.isna(val):
        return None
    val_str = str(val).strip()
    if re.match(r"^\d+\.0$", val_str):
        val_str = val_str[:-2]
    return val_str if val_str else None


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
            low = str(col).lower()
            if any(token in low for token in fuzzy_tokens):
                return str(col)
    return None


def _candidate_from_entry(entry: dict, score: float, match_threshold: float, review_threshold: float) -> dict:
    prod = entry["product"]
    var = entry["variant"]
    status = "matched" if score >= match_threshold else ("review" if score >= review_threshold else "no_match")
    return {
        "score": round(score, 3),
        "status": status,
        "id": str(prod.get("id") or ""),
        "sku": var.get("sku") or prod.get("sku") or "",
        "name_en": prod.get("name_en") or prod.get("title_en") or "",
        "price": var.get("price") or prod.get("price"),
        "db_code": prod.get("code") or "",
        "db_international_barcode": prod.get("international_barcode") or "",
        "image": var.get("image") or prod.get("image"),
        "db_normalized": entry.get("normalized", ""),
    }


def _classify_enrichment(
    *,
    top: Optional[dict],
    sheet_barcode: Optional[str],
    sheet_code: Optional[str],
    match_threshold: float,
    review_threshold: float,
) -> Dict[str, Any]:
    """Decide enrichment_status / review_reason / apply_status for a row."""
    if not sheet_barcode:
        return {
            "enrichment_status": "no_match",
            "review_reason": "missing_sheet_barcode",
            "apply_status": "pending",
            "db_product_id": None,
            "db_name_en": None,
            "db_code": None,
            "db_international_barcode": None,
            "score": 0.0,
        }

    if not top:
        return {
            "enrichment_status": "no_match",
            "review_reason": None,
            "apply_status": "pending",
            "db_product_id": None,
            "db_name_en": None,
            "db_code": None,
            "db_international_barcode": None,
            "score": 0.0,
        }

    score = float(top.get("score") or 0)
    db_id = str(top.get("id") or "")
    db_name = top.get("name_en") or ""
    db_code = top.get("db_code") or ""
    db_barcode = top.get("db_international_barcode") or ""
    sheet_key = normalize_lookup_key(sheet_barcode)
    db_key = normalize_lookup_key(db_barcode)

    base = {
        "db_product_id": db_id or None,
        "db_name_en": db_name,
        "db_code": db_code,
        "db_international_barcode": db_barcode,
        "score": score,
        "sheet_code": sheet_code,
        "sheet_barcode": sheet_barcode,
    }

    if score < review_threshold:
        return {
            **base,
            "enrichment_status": "no_match",
            "review_reason": None,
            "apply_status": "pending",
        }

    if score < match_threshold:
        return {
            **base,
            "enrichment_status": "review",
            "review_reason": "low_confidence",
            "apply_status": "pending",
        }

    # High-confidence match
    if not db_key:
        return {
            **base,
            "enrichment_status": "matched",
            "review_reason": None,
            "apply_status": "pending",
        }

    if db_key == sheet_key:
        return {
            **base,
            "enrichment_status": "already_synced",
            "review_reason": None,
            "apply_status": "applied",
        }

    return {
        **base,
        "enrichment_status": "review",
        "review_reason": "barcode_conflict",
        "apply_status": "pending",
    }


def process_enrichment_row(
    idx: int,
    raw_name: str,
    norm_name: str,
    sheet_barcode: Optional[str],
    sheet_code: Optional[str],
    index_inst: ProductIndex,
    top_k: int,
    match_threshold: float,
    review_threshold: float,
    match_with_code: bool = True,
) -> dict:
    matching_method = "normalizer"
    matches: List[dict] = []

    if match_with_code and sheet_code:
        entry = index_inst.lookup_entry_by_code(sheet_code)
        if entry:
            matching_method = "code"
            matches = [_candidate_from_entry(entry, 1.0, match_threshold, review_threshold)]

    if not matches and norm_name:
        matching_method = "normalizer"
        for m in index_inst.search(norm_name, top_k=top_k):
            prod = m["entry"]["product"]
            var = m["entry"]["variant"]
            score = m["score"]
            status = "matched" if score >= match_threshold else ("review" if score >= review_threshold else "no_match")
            matches.append(
                {
                    "score": round(score, 3),
                    "status": status,
                    "id": str(prod.get("id") or ""),
                    "sku": var.get("sku") or prod.get("sku") or "",
                    "name_en": prod.get("name_en") or prod.get("title_en") or "",
                    "price": var.get("price") or prod.get("price"),
                    "db_code": prod.get("code") or "",
                    "db_international_barcode": prod.get("international_barcode") or "",
                    "image": var.get("image") or prod.get("image"),
                    "db_normalized": m.get("db_normalized", ""),
                    "jaccard": m.get("jaccard", 0),
                    "sequence": m.get("sequence", 0),
                    "matched_tokens": m.get("matched_tokens", []),
                    "unmatched_query_tokens": m.get("unmatched_query_tokens", []),
                    "unmatched_db_tokens": m.get("unmatched_db_tokens", []),
                }
            )

    top = matches[0] if matches else None
    classified = _classify_enrichment(
        top=top,
        sheet_barcode=sheet_barcode,
        sheet_code=sheet_code,
        match_threshold=match_threshold,
        review_threshold=review_threshold,
    )

    return {
        "row_index": idx,
        "original_name": raw_name,
        "normalized_name": norm_name,
        "sheet_barcode": sheet_barcode,
        "sheet_code": sheet_code,
        "matching_method": matching_method if matches else "none",
        "matches": matches,
        **classified,
    }


async def _broadcast(job_id: str, event: str, payload: dict) -> None:
    if job_id not in job_listeners:
        return
    message = f"event: {event}\ndata: {json.dumps(payload)}\n\n"
    for q in list(job_listeners[job_id]):
        await q.put(message)


async def run_enrichment_background(
    job_id: str,
    file_bytes: bytes,
    file_ext: str,
    *,
    name_column: Optional[str],
    barcode_column: Optional[str],
    code_column: Optional[str],
    top: int = 5,
    match_threshold: float = 0.60,
    review_threshold: float = 0.40,
    match_with_code: bool = True,
    index_inst: Optional[ProductIndex] = None,
) -> None:
    try:
        update_job_pid(job_id, os.getpid())

        try:
            df = load_sheet_safely(file_bytes, file_ext)
        except Exception as parse_err:
            finalize_job(job_id, "failed", error_msg=f"Failed to parse sheet: {parse_err}")
            await _broadcast(job_id, "error", {"message": str(parse_err)})
            return

        jobs_dir = os.path.join(project_root, "data", "enrichment", "jobs", job_id)
        os.makedirs(jobs_dir, exist_ok=True)
        with open(os.path.join(jobs_dir, f"original{file_ext}"), "wb") as f:
            f.write(file_bytes)

        columns = [str(c) for c in df.columns]
        name_col = name_column or detect_column(
            columns, NAME_COLUMN_CANDIDATES, fuzzy_tokens=["name", "اسم", "product"]
        )
        barcode_col = barcode_column or detect_column(
            columns,
            BARCODE_COLUMN_CANDIDATES,
            fuzzy_tokens=["barcode", "ean", "upc", "gtin", "باركود"],
        )
        code_col = code_column or detect_column(
            columns, CODE_COLUMN_CANDIDATES, fuzzy_tokens=["code", "كود", "sku"]
        )

        if not name_col:
            msg = "Product name column could not be detected."
            finalize_job(job_id, "failed", error_msg=msg)
            await _broadcast(job_id, "error", {"message": msg})
            return
        if not barcode_col:
            msg = "International barcode column could not be detected."
            finalize_job(job_id, "failed", error_msg=msg)
            await _broadcast(job_id, "error", {"message": msg})
            return

        if index_inst is None:
            from tools.matcher import load_products_data

            products_data = load_products_data()
            index_inst = ProductIndex(products_data)

        total_rows = len(df)
        await _broadcast(
            job_id,
            "info",
            {
                "total_rows": total_rows,
                "name_column": name_col,
                "barcode_column": barcode_col,
                "code_column": code_col,
                "job_id": job_id,
            },
        )

        results_list: List[dict] = []
        matched_count = review_count = no_match_count = already_count = 0

        for row_i, (_, row) in enumerate(df.iterrows()):
            from tools.enrichment_db import get_job

            current = get_job(job_id)
            if current and current["status"] == "stopped":
                return

            raw_name = str(row[name_col]) if pd.notna(row[name_col]) else ""
            norm_name = normalize(raw_name) if raw_name else ""
            sheet_barcode = _extract_cell_string(row[barcode_col]) if barcode_col in df.columns else None
            sheet_code = None
            if code_col and code_col in df.columns:
                sheet_code = _extract_cell_string(row[code_col])

            payload = process_enrichment_row(
                row_i,
                raw_name,
                norm_name,
                sheet_barcode,
                sheet_code,
                index_inst,
                top,
                match_threshold,
                review_threshold,
                match_with_code=match_with_code,
            )
            results_list.append(payload)

            status = payload.get("enrichment_status")
            if status == "matched":
                matched_count += 1
            elif status == "review":
                review_count += 1
            elif status == "already_synced":
                already_count += 1
            else:
                no_match_count += 1

            processed = len(results_list)
            if processed % 10 == 0 or processed == total_rows:
                update_job_progress(
                    job_id,
                    processed_rows=processed,
                    matched_count=matched_count,
                    review_count=review_count,
                    no_match_count=no_match_count,
                    already_synced_count=already_count,
                )
                try:
                    save_results(job_id, results_list)
                except Exception as write_err:
                    print(f"Failed to write enrichment results for {job_id}: {write_err}")

                await _broadcast(
                    job_id,
                    "progress",
                    {
                        "processed_rows": processed,
                        "total_rows": total_rows,
                        "matched_count": matched_count,
                        "review_count": review_count,
                        "no_match_count": no_match_count,
                        "already_synced_count": already_count,
                    },
                )

            if processed % 25 == 0:
                await asyncio.sleep(0.01)

        save_results(job_id, results_list)
        counts = recount_stats(results_list)
        update_job_progress(
            job_id,
            processed_rows=total_rows,
            matched_count=counts["matched_count"],
            review_count=counts["review_count"],
            no_match_count=counts["no_match_count"],
            already_synced_count=counts["already_synced_count"],
        )
        update_job_counts(job_id, **counts)
        finalize_job(job_id, "completed")
        await _broadcast(
            job_id,
            "complete",
            {
                "status": "completed",
                **counts,
            },
        )
    except Exception as exc:
        finalize_job(job_id, "failed", error_msg=str(exc))
        await _broadcast(job_id, "error", {"message": str(exc)})
        raise
