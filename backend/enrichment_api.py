"""Barcode enrichment API — upload sheet, match, apply barcodes to live catalog."""

from __future__ import annotations

import asyncio
import os
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db import catalog_repo
from tools.csv_helper import load_sheet_safely
from tools.enrichment_db import (
    create_job,
    finalize_job,
    get_job,
    get_jobs,
    load_results,
    recount_stats,
    save_results,
    update_job_counts,
)
from tools.enrichment_runner import (
    detect_column,
    job_listeners,
    run_enrichment_background,
    BARCODE_COLUMN_CANDIDATES,
    CODE_COLUMN_CANDIDATES,
)
from tools.matcher import NAME_COLUMN_CANDIDATES, normalize_lookup_key

router = APIRouter(prefix="/api/enrichment", tags=["enrichment"])

# Injected from api.py at startup
_get_index = None
_reload_index = None


def register_enrichment_deps(get_index_fn, reload_index_fn) -> None:
    global _get_index, _reload_index
    _get_index = get_index_fn
    _reload_index = reload_index_fn


class ResolveRequest(BaseModel):
    row_index: int
    action: str  # override | skip
    product_id: Optional[str] = None  # optional manual product pick


class ManualMatchRequest(BaseModel):
    row_index: int
    product_id: str


def _require_job(job_id: str) -> Dict[str, Any]:
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _find_index_product(product_id: str) -> Optional[Dict[str, Any]]:
    index = _get_index() if _get_index else None
    if not index:
        return None
    pid = str(product_id)
    for entry in index.entries:
        prod = entry["product"]
        if str(prod.get("id") or "") == pid:
            return {
                "id": pid,
                "name_en": prod.get("name_en") or prod.get("title_en") or "",
                "db_code": prod.get("code") or "",
                "db_international_barcode": prod.get("international_barcode") or "",
                "sku": entry["variant"].get("sku") or prod.get("sku") or "",
                "score": 1.0,
                "status": "matched",
            }
    return None


@router.post("/detect-columns")
async def detect_columns(file: UploadFile = File(...)):
    content = await file.read()
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    try:
        df = load_sheet_safely(content, file_ext)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {e}")

    columns = [str(c) for c in df.columns]
    return {
        "columns": columns,
        "suggested": {
            "name_column": detect_column(
                columns, NAME_COLUMN_CANDIDATES, fuzzy_tokens=["name", "اسم", "product"]
            ),
            "barcode_column": detect_column(
                columns,
                BARCODE_COLUMN_CANDIDATES,
                fuzzy_tokens=["barcode", "ean", "upc", "gtin", "باركود"],
            ),
            "code_column": detect_column(
                columns, CODE_COLUMN_CANDIDATES, fuzzy_tokens=["code", "كود", "sku"]
            ),
        },
        "preview": df.head(5).fillna("").astype(str).to_dict(orient="records"),
    }


@router.post("/run")
async def run_enrichment_job(
    file: UploadFile = File(...),
    name_column: Optional[str] = Form(None),
    barcode_column: Optional[str] = Form(None),
    code_column: Optional[str] = Form(None),
    top: int = Form(5),
    match_threshold: float = Form(0.60),
    review_threshold: float = Form(0.40),
    match_with_code: bool = Form(True),
    background: bool = Form(True),
):
    content = await file.read()
    file_ext = os.path.splitext(file.filename or "sheet.xlsx")[1].lower()
    try:
        df = load_sheet_safely(content, file_ext)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {e}")

    job_id = str(uuid.uuid4())
    job_info = create_job(
        job_id=job_id,
        filename=file.filename or "sheet.xlsx",
        name_column=name_column or "",
        barcode_column=barcode_column or "",
        code_column=code_column,
        match_threshold=match_threshold,
        review_threshold=review_threshold,
        total_rows=len(df),
    )

    index = _get_index() if _get_index else None
    asyncio.create_task(
        run_enrichment_background(
            job_id=job_id,
            file_bytes=content,
            file_ext=file_ext,
            name_column=name_column,
            barcode_column=barcode_column,
            code_column=code_column,
            top=top,
            match_threshold=match_threshold,
            review_threshold=review_threshold,
            match_with_code=match_with_code,
            index_inst=index,
        )
    )

    if background:
        return job_info

    async def event_generator():
        await asyncio.sleep(0.1)
        queue: asyncio.Queue = asyncio.Queue()
        if job_id not in job_listeners:
            job_listeners[job_id] = set()
        job_listeners[job_id].add(queue)
        try:
            while True:
                event = await queue.get()
                yield event
                if "event: complete" in event or "event: error" in event:
                    break
        finally:
            job_listeners[job_id].discard(queue)
            if not job_listeners[job_id]:
                job_listeners.pop(job_id, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/jobs")
async def list_enrichment_jobs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
):
    return get_jobs(limit=limit, offset=offset, status=status)


@router.get("/job/{job_id}")
async def get_enrichment_job(job_id: str):
    return _require_job(job_id)


@router.post("/job/{job_id}/stop")
async def stop_enrichment_job(job_id: str):
    job = _require_job(job_id)
    if job["status"] not in ("pending", "running"):
        return {"status": job["status"], "message": f"Job already {job['status']}"}
    finalize_job(job_id, "stopped", error_msg="Stopped by admin.")
    try:
        results = load_results(job_id)
        if results:
            counts = recount_stats(results)
            update_job_counts(job_id, **counts)
    except Exception:
        pass
    if job_id in job_listeners:
        payload = '{"status":"stopped"}'
        for q in list(job_listeners[job_id]):
            await q.put(f"event: complete\ndata: {payload}\n\n")
    return {"status": "stopped"}


@router.get("/job/{job_id}/results")
async def get_enrichment_results(
    job_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100000),
    status: Optional[str] = Query(None),
    apply_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    job = _require_job(job_id)
    try:
        all_results = load_results(job_id)
    except Exception as e:
        if job["status"] in ("pending", "running"):
            all_results = []
        else:
            raise HTTPException(status_code=500, detail=str(e))

    stats = {
        "total": job.get("total_rows", 0),
        "matched": job.get("matched_count", 0),
        "review": job.get("review_count", 0),
        "noMatch": job.get("no_match_count", 0),
        "alreadySynced": job.get("already_synced_count", 0),
        "applied": job.get("applied_count", 0),
        "pendingApply": job.get("pending_apply_count", 0),
        "duration": job.get("duration"),
    }

    filtered: List[dict] = []
    for item in all_results:
        if status and item.get("enrichment_status") != status:
            continue
        item_apply = item.get("apply_status") or "pending"
        if apply_status and item_apply != apply_status:
            continue
        # Pending apply preview: exclude rows whose barcode already matches DB
        if (
            apply_status == "pending"
            and status == "matched"
            and item_apply == "pending"
        ):
            sheet_key = normalize_lookup_key(item.get("sheet_barcode"))
            db_key = normalize_lookup_key(item.get("db_international_barcode"))
            if sheet_key and db_key and sheet_key == db_key:
                continue
        if search:
            q = search.lower()
            hay = " ".join(
                [
                    str(item.get("original_name") or ""),
                    str(item.get("sheet_barcode") or ""),
                    str(item.get("db_name_en") or ""),
                    str(item.get("db_product_id") or ""),
                ]
            ).lower()
            if q not in hay:
                continue
        filtered.append(item)

    return {
        "job_id": job_id,
        "total": len(filtered),
        "total_unfiltered": len(all_results),
        "limit": limit,
        "offset": offset,
        "results": filtered[offset : offset + limit],
        "stats": stats,
        "job_status": job.get("status"),
    }


@router.post("/job/{job_id}/apply-matched")
async def apply_matched(job_id: str):
    job = _require_job(job_id)
    if job["status"] not in ("completed", "stopped"):
        raise HTTPException(status_code=400, detail="Job must be completed before applying")

    results = load_results(job_id)
    applied = 0
    skipped = 0
    already_same = 0
    errors: List[str] = []

    for item in results:
        if item.get("enrichment_status") != "matched":
            continue
        if item.get("apply_status") in ("applied", "overridden", "skipped"):
            skipped += 1
            continue
        product_id = item.get("db_product_id")
        barcode = item.get("sheet_barcode")
        if not product_id or not barcode:
            errors.append(f"row {item.get('row_index')}: missing product or barcode")
            continue

        sheet_key = normalize_lookup_key(barcode)
        # Prefer live DB barcode so we don't rewrite identical values
        live = catalog_repo.get_live_product(str(product_id))
        live_barcode = ""
        if live:
            live_barcode = live.get("international_barcode") or ""
        snapshot_barcode = item.get("db_international_barcode") or ""
        current_key = normalize_lookup_key(live_barcode or snapshot_barcode)

        if current_key and current_key == sheet_key:
            # Already has the same barcode — no write needed
            item["enrichment_status"] = "already_synced"
            item["apply_status"] = "applied"
            item["db_international_barcode"] = current_key
            item["review_reason"] = None
            already_same += 1
            skipped += 1
            continue

        ok = catalog_repo.update_product_codes(
            product_id,
            international_barcode=barcode,
            code=item.get("sheet_code"),
        )
        if ok:
            item["apply_status"] = "applied"
            item["db_international_barcode"] = barcode
            if item.get("sheet_code"):
                item["db_code"] = item["sheet_code"]
            applied += 1
        else:
            errors.append(f"row {item.get('row_index')}: product {product_id} not found")

    save_results(job_id, results)
    counts = recount_stats(results)
    update_job_counts(job_id, **counts)

    reload_info = None
    if applied and _reload_index:
        reload_info = _reload_index()

    return {
        "applied": applied,
        "skipped": skipped,
        "already_same": already_same,
        "errors": errors,
        "stats": counts,
        "reload": reload_info,
    }


@router.post("/job/{job_id}/resolve")
async def resolve_review(job_id: str, req: ResolveRequest):
    job = _require_job(job_id)
    if job["status"] not in ("completed", "stopped"):
        raise HTTPException(status_code=400, detail="Job must be completed before resolving")

    action = (req.action or "").lower().strip()
    if action not in ("override", "skip"):
        raise HTTPException(status_code=400, detail="action must be override or skip")

    results = load_results(job_id)
    target = next((r for r in results if r.get("row_index") == req.row_index), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Row {req.row_index} not found")

    if action == "skip":
        target["apply_status"] = "skipped"
        save_results(job_id, results)
        counts = recount_stats(results)
        update_job_counts(job_id, **counts)
        return {"row_index": req.row_index, "apply_status": "skipped", "stats": counts}

    # override
    product_id = req.product_id or target.get("db_product_id")
    barcode = target.get("sheet_barcode")
    if not product_id or not barcode:
        raise HTTPException(status_code=400, detail="Missing product_id or sheet barcode")

    if req.product_id and req.product_id != target.get("db_product_id"):
        picked = _find_index_product(req.product_id)
        if picked:
            target["db_product_id"] = picked["id"]
            target["db_name_en"] = picked["name_en"]
            target["db_code"] = picked["db_code"]
            target["db_international_barcode"] = picked["db_international_barcode"]
            target["matches"] = [picked] + [
                m for m in (target.get("matches") or []) if m.get("id") != picked["id"]
            ]

    # conflict safety: if barcodes differ, still allow override (admin confirmed)
    ok = catalog_repo.update_product_codes(
        product_id,
        international_barcode=barcode,
        code=target.get("sheet_code"),
    )
    if not ok:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found in catalog")

    target["apply_status"] = "overridden"
    target["enrichment_status"] = "matched"
    target["review_reason"] = target.get("review_reason")  # keep history
    target["db_international_barcode"] = barcode
    if target.get("sheet_code"):
        target["db_code"] = target["sheet_code"]

    save_results(job_id, results)
    counts = recount_stats(results)
    update_job_counts(job_id, **counts)

    reload_info = _reload_index() if _reload_index else None
    return {
        "row_index": req.row_index,
        "apply_status": "overridden",
        "stats": counts,
        "reload": reload_info,
    }


@router.post("/job/{job_id}/manual-match")
async def manual_match(job_id: str, req: ManualMatchRequest):
    """Assign a catalog product to a row and reclassify (does not write DB until apply/override)."""
    _require_job(job_id)
    results = load_results(job_id)
    target = next((r for r in results if r.get("row_index") == req.row_index), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Row {req.row_index} not found")

    picked = _find_index_product(req.product_id)
    live = catalog_repo.get_live_product(req.product_id)
    if not picked and not live:
        raise HTTPException(status_code=404, detail="Product not found")

    db_barcode = ""
    db_code = ""
    db_name = ""
    if live:
        db_barcode = live.get("international_barcode") or ""
        db_code = live.get("code") or ""
        db_name = live.get("title_en") or live.get("title_ar") or ""
    if picked:
        db_barcode = picked.get("db_international_barcode") or db_barcode
        db_code = picked.get("db_code") or db_code
        db_name = picked.get("name_en") or db_name

    sheet_barcode = target.get("sheet_barcode") or ""
    sheet_key = normalize_lookup_key(sheet_barcode)
    db_key = normalize_lookup_key(db_barcode)

    target["db_product_id"] = str(req.product_id)
    target["db_name_en"] = db_name
    target["db_code"] = db_code
    target["db_international_barcode"] = db_barcode
    target["score"] = 1.0
    target["matching_method"] = "manual"
    target["apply_status"] = "pending"

    if not sheet_key:
        target["enrichment_status"] = "no_match"
        target["review_reason"] = "missing_sheet_barcode"
    elif not db_key:
        target["enrichment_status"] = "matched"
        target["review_reason"] = None
    elif db_key == sheet_key:
        target["enrichment_status"] = "already_synced"
        target["apply_status"] = "applied"
        target["review_reason"] = None
    else:
        target["enrichment_status"] = "review"
        target["review_reason"] = "barcode_conflict"

    candidate = {
        "score": 1.0,
        "status": "matched",
        "id": str(req.product_id),
        "sku": (picked or {}).get("sku") or "",
        "name_en": db_name,
        "db_code": db_code,
        "db_international_barcode": db_barcode,
    }
    target["matches"] = [candidate] + [
        m for m in (target.get("matches") or []) if str(m.get("id")) != str(req.product_id)
    ]

    save_results(job_id, results)
    counts = recount_stats(results)
    update_job_counts(job_id, **counts)
    return {"row": target, "stats": counts}


@router.get("/job/{job_id}/stream")
async def stream_enrichment_job(job_id: str):
    _require_job(job_id)

    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()
        if job_id not in job_listeners:
            job_listeners[job_id] = set()
        job_listeners[job_id].add(queue)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield event
                    if "event: complete" in event or "event: error" in event:
                        break
                except asyncio.TimeoutError:
                    yield "event: ping\ndata: {}\n\n"
                    job = get_job(job_id)
                    if job and job["status"] in ("completed", "failed", "stopped"):
                        yield f"event: complete\ndata: {{\"status\":\"{job['status']}\"}}\n\n"
                        break
        finally:
            job_listeners[job_id].discard(queue)
            if not job_listeners[job_id]:
                job_listeners.pop(job_id, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
