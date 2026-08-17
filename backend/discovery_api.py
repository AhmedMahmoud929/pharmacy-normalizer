"""Product discovery API — search external sources for unmatched products."""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db import catalog_repo
from tools.csv_helper import load_sheet_safely
from tools.discovery_db import (
    create_job,
    finalize_job,
    get_job,
    get_jobs,
    load_results,
    recount_stats,
    save_results,
    update_job_counts,
)
from tools.discovery_runner import (
    detect_column,
    discovery_product_to_catalog,
    job_listeners,
    run_discovery_background,
    stream_discovery_try,
)
from tools.matcher import NAME_COLUMN_CANDIDATES
from tools.matcher_db import get_jobs as get_matcher_jobs
from tools.source_profiles_repo import list_profiles

router = APIRouter(prefix="/api/discovery", tags=["discovery"])

_reload_index = None


def register_discovery_deps(reload_index_fn) -> None:
    global _reload_index
    _reload_index = reload_index_fn


class ResolveRequest(BaseModel):
    row_index: int
    action: str  # accept | reject | pick
    candidate_index: Optional[int] = None


class TryRequest(BaseModel):
    product_name: str
    source_domains: Optional[List[str]] = None
    match_threshold: float = 0.60
    review_threshold: float = 0.40


def _require_job(job_id: str) -> Dict[str, Any]:
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/matcher-jobs")
async def list_matcher_jobs_for_discovery(
    limit: int = Query(50, ge=1, le=100),
):
    """List completed matcher jobs that can feed no-match rows."""
    data = get_matcher_jobs(limit=limit, offset=0)
    jobs = data.get("jobs") if isinstance(data, dict) else data
    if not isinstance(jobs, list):
        jobs = []
    eligible = []
    for job in jobs:
        if job.get("status") not in ("completed", "stopped"):
            continue
        if (job.get("no_match_count") or 0) > 0:
            eligible.append(
                {
                    "job_id": job.get("job_id"),
                    "filename": job.get("filename"),
                    "no_match_count": job.get("no_match_count"),
                    "created_at": job.get("created_at"),
                }
            )
    return {"jobs": eligible}


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
                columns, NAME_COLUMN_CANDIDATES, fuzzy_tokens=["name", "product", "اسم"]
            ),
        },
        "preview": df.head(5).fillna("").astype(str).to_dict(orient="records"),
    }


@router.post("/run")
async def run_discovery_job(
    input_type: str = Form(...),
    matcher_job_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    name_column: Optional[str] = Form(None),
    source_domains: Optional[str] = Form(None),
    match_threshold: float = Form(0.60),
    review_threshold: float = Form(0.40),
    background: bool = Form(True),
):
    input_type = (input_type or "").lower().strip()
    if input_type not in ("matcher", "upload"):
        raise HTTPException(status_code=400, detail="input_type must be matcher or upload")

    domains: List[str] = []
    if source_domains:
        try:
            parsed = json.loads(source_domains)
            if isinstance(parsed, list):
                domains = [str(d) for d in parsed]
            else:
                domains = [d.strip() for d in source_domains.split(",") if d.strip()]
        except json.JSONDecodeError:
            domains = [d.strip() for d in source_domains.split(",") if d.strip()]

    file_bytes = None
    file_ext = ".xlsx"
    filename = "matcher-no-match"
    total_rows = 0

    if input_type == "upload":
        if not file:
            raise HTTPException(status_code=400, detail="file is required for upload input")
        file_bytes = await file.read()
        file_ext = os.path.splitext(file.filename or "sheet.xlsx")[1].lower()
        filename = file.filename or "sheet.xlsx"
        df = load_sheet_safely(file_bytes, file_ext)
        total_rows = len(df)
    else:
        if not matcher_job_id:
            raise HTTPException(status_code=400, detail="matcher_job_id is required")
        from tools.matcher_db import get_job as get_matcher_job

        matcher_job = get_matcher_job(matcher_job_id)
        if not matcher_job:
            raise HTTPException(status_code=404, detail="Matcher job not found")
        total_rows = int(matcher_job.get("no_match_count") or 0)
        filename = matcher_job.get("filename") or f"matcher-{matcher_job_id[:8]}-no-match"

    job_id = str(uuid.uuid4())
    job_info = create_job(
        job_id=job_id,
        filename=filename,
        input_type=input_type,
        matcher_job_id=matcher_job_id,
        name_column=name_column or "",
        source_domains=domains or None,
        match_threshold=match_threshold,
        review_threshold=review_threshold,
        total_rows=total_rows,
    )

    asyncio.create_task(
        run_discovery_background(
            job_id=job_id,
            input_type=input_type,
            matcher_job_id=matcher_job_id,
            file_bytes=file_bytes,
            file_ext=file_ext,
            name_column=name_column,
            source_domains=domains or None,
            match_threshold=match_threshold,
            review_threshold=review_threshold,
        )
    )

    if background:
        return job_info

    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()
        job_listeners.setdefault(job_id, set()).add(queue)
        try:
            while True:
                event = await queue.get()
                yield event
                if "event: complete" in event or "event: error" in event:
                    break
        finally:
            job_listeners[job_id].discard(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/jobs")
async def list_discovery_jobs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
):
    return get_jobs(limit=limit, offset=offset, status=status)


@router.get("/job/{job_id}")
async def get_discovery_job(job_id: str):
    return _require_job(job_id)


@router.post("/job/{job_id}/stop")
async def stop_discovery_job(job_id: str):
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
async def get_discovery_results(
    job_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100000),
    status: Optional[str] = Query(None),
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
        "found": job.get("found_count", 0),
        "review": job.get("review_count", 0),
        "notFound": job.get("not_found_count", 0),
        "imported": job.get("imported_count", 0),
        "duration": job.get("duration"),
    }

    filtered: List[dict] = []
    for item in all_results:
        if status and item.get("discovery_status") != status:
            continue
        if search:
            q = search.lower()
            hay = " ".join(
                [
                    str(item.get("original_name") or ""),
                    str(item.get("title_en") or ""),
                    str(item.get("source_domain") or ""),
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


@router.post("/job/{job_id}/resolve")
async def resolve_discovery_row(job_id: str, req: ResolveRequest):
    job = _require_job(job_id)
    if job["status"] not in ("completed", "stopped", "running"):
        raise HTTPException(status_code=400, detail="Job must be finished or stopped before resolving")

    action = (req.action or "").lower().strip()
    if action not in ("accept", "reject", "pick"):
        raise HTTPException(status_code=400, detail="action must be accept, reject, or pick")

    results = load_results(job_id)
    target = next((r for r in results if r.get("row_index") == req.row_index), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Row {req.row_index} not found")

    if action == "reject":
        target["discovery_status"] = "not_found"
        target["import_status"] = "rejected"
    elif action == "accept":
        target["discovery_status"] = "found"
        target["import_status"] = "pending"
    elif action == "pick":
        candidates = target.get("candidates") or []
        if req.candidate_index is None or req.candidate_index >= len(candidates):
            raise HTTPException(status_code=400, detail="Invalid candidate_index")
        picked = candidates[req.candidate_index]
        target["discovery_status"] = "found"
        target["import_status"] = "pending"
        target["source_domain"] = picked.get("source_domain")
        target["source_url"] = picked.get("source_url") or picked.get("url")
        target["title_en"] = picked.get("title_en") or picked.get("title")
        target["title_ar"] = picked.get("title_ar") or ""
        target["price"] = picked.get("price")
        target["image_url"] = picked.get("image_url")
        target["barcode"] = picked.get("barcode")
        target["brand"] = picked.get("brand")
        target["score"] = picked.get("score")

    save_results(job_id, results)
    counts = recount_stats(results)
    update_job_counts(job_id, **counts)
    return {"row": target, "stats": counts}


@router.post("/job/{job_id}/import")
async def import_discovery_results(job_id: str):
    job = _require_job(job_id)
    if job["status"] not in ("completed", "stopped"):
        raise HTTPException(status_code=400, detail="Job must be completed before import")

    results = load_results(job_id)
    to_import = []
    imported = 0
    skipped = 0

    for item in results:
        if item.get("discovery_status") != "found":
            continue
        if item.get("import_status") == "imported":
            skipped += 1
            continue
        domain = item.get("source_domain") or "discovery"
        catalog_product = discovery_product_to_catalog(item, domain)
        to_import.append(catalog_product)
        item["import_status"] = "imported"
        imported += 1

    if to_import:
        catalog_repo.import_products_to_staging(to_import, clear_first=False)

    save_results(job_id, results)
    counts = recount_stats(results)
    update_job_counts(job_id, **counts)

    reload_info = _reload_index() if _reload_index and imported else None
    return {
        "imported": imported,
        "skipped": skipped,
        "stats": counts,
        "reload": reload_info,
    }


@router.get("/sources")
async def list_available_sources():
    return {"profiles": list_profiles(enabled_only=True)}


@router.post("/try")
async def try_discovery_product(req: TryRequest):
    """Run discovery for one product with live step-by-step SSE feedback."""
    name = (req.product_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="product_name is required")

    return StreamingResponse(
        stream_discovery_try(
            name,
            source_domains=req.source_domains or None,
            match_threshold=req.match_threshold,
            review_threshold=req.review_threshold,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/job/{job_id}/stream")
async def stream_discovery_job(job_id: str):
    _require_job(job_id)

    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()
        job_listeners.setdefault(job_id, set()).add(queue)
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

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
