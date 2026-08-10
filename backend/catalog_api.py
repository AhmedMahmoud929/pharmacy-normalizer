"""FastAPI routes for catalog management and refresh pipeline."""

from __future__ import annotations

import asyncio
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from db import catalog_repo, pipeline_repo
from db.pipeline import (
    DEFAULT_STEPS,
    FULL_STEPS,
    _pipeline_listeners,
    confirm_promote,
    force_cancel_pipeline,
    run_pipeline,
)
from db.schema import init_schema

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

_workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class CatalogPipelineRequest(BaseModel):
    steps: Optional[List[str]] = Field(
        default=None,
        description=f"Pipeline steps. Default: {DEFAULT_STEPS}. Full refresh: {FULL_STEPS}",
    )
    crawl_options: Optional[Dict[str, Any]] = None
    import_source_path: Optional[str] = Field(
        default=None,
        description="Optional path to import JSON (skips crawl if import step runs without crawl)",
    )
    background: bool = True


def set_workspace_root(path: str) -> None:
    global _workspace_root
    _workspace_root = path


# Module-level callback set by api.py on startup
_reload_catalog_index = None


def register_reload_callback(fn) -> None:
    global _reload_catalog_index
    _reload_catalog_index = fn


@router.get("/stats")
async def catalog_stats():
    init_schema()
    return catalog_repo.get_catalog_stats()


@router.post("/pipeline/run")
async def start_catalog_pipeline(req: CatalogPipelineRequest):
    init_schema()
    steps = req.steps or DEFAULT_STEPS
    job_id = await run_pipeline(
        steps=steps,
        crawl_options=req.crawl_options,
        import_source_path=req.import_source_path,
        reload_index_fn=_reload_catalog_index,
        workspace_root=_workspace_root,
    )
    return {
        "job_id": job_id,
        "status": "running",
        "steps": steps,
        "message": "Catalog pipeline started.",
    }


@router.get("/pipeline/jobs")
async def list_catalog_pipeline_jobs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    init_schema()
    return pipeline_repo.list_pipeline_jobs(limit=limit, offset=offset)


@router.get("/pipeline/jobs/{job_id}")
async def get_catalog_pipeline_job(job_id: str):
    init_schema()
    job = pipeline_repo.get_pipeline_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Pipeline job not found")
    return job


@router.post("/pipeline/jobs/{job_id}/cancel")
async def cancel_catalog_pipeline(job_id: str):
    init_schema()
    job = pipeline_repo.get_pipeline_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Pipeline job not found")
    if job["status"] not in ("pending", "running", "awaiting_promotion"):
        return {"status": job["status"], "message": f"Job is already {job['status']}."}

    force_cancel_pipeline(job_id)
    job = pipeline_repo.get_pipeline_job(job_id)
    return {
        "status": job["status"] if job else "cancelled",
        "message": "Pipeline cancelled.",
    }


@router.post("/pipeline/jobs/{job_id}/confirm-promote")
async def confirm_promote_pipeline(job_id: str):
    init_schema()
    job = pipeline_repo.get_pipeline_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Pipeline job not found")
    if job["status"] != "awaiting_promotion":
        raise HTTPException(
            status_code=400,
            detail=f"Job is not awaiting promotion confirmation (status: {job['status']}).",
        )
    if not confirm_promote(job_id):
        raise HTTPException(
            status_code=409,
            detail="Could not confirm promotion. The pipeline may have stopped or the server restarted.",
        )
    return {"status": "running", "message": "Promotion confirmed. Replacing live catalog…"}


@router.get("/pipeline/jobs/{job_id}/stream")
async def stream_catalog_pipeline(job_id: str):
    init_schema()
    job = pipeline_repo.get_pipeline_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Pipeline job not found")

    queue: asyncio.Queue = asyncio.Queue(maxsize=200)
    if job_id not in _pipeline_listeners:
        _pipeline_listeners[job_id] = []
    _pipeline_listeners[job_id].append(queue)

    async def event_generator():
        try:
            yield f"event: connected\ndata: {{\"job_id\": \"{job_id}\"}}\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield msg
                    if "pipeline_complete" in msg or "pipeline_error" in msg or "pipeline_cancelled" in msg:
                        break
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    refreshed = pipeline_repo.get_pipeline_job(job_id)
                    if refreshed and refreshed["status"] in ("completed", "failed", "cancelled"):
                        break
        finally:
            if job_id in _pipeline_listeners:
                _pipeline_listeners[job_id] = [q for q in _pipeline_listeners[job_id] if q is not queue]

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/reload")
async def reload_catalog():
    if _reload_catalog_index is None:
        raise HTTPException(status_code=503, detail="Catalog reload not configured")
    result = _reload_catalog_index()
    if asyncio.iscoroutine(result):
        await result
    return {"status": "ok", "catalog": catalog_repo.get_catalog_stats()}
