"""Media gallery API — browse local images and fetch missing CDN assets."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from db import catalog_repo
from tools.gallery_runner import (
    MEDIA_ROOT,
    get_current_job,
    job_listeners,
    run_gallery_fetch,
    stop_gallery_fetch,
)

router = APIRouter(prefix="/api/gallery", tags=["gallery"])

# Injected from api.py
_enrich_product = None
_sanitize_filename = None
_normalize_cdn_url = None
_fix_dotless_url = None


def register_gallery_deps(
    enrich_product_fn,
    sanitize_filename_fn,
    normalize_cdn_url_fn,
    fix_dotless_url_fn,
) -> None:
    global _enrich_product, _sanitize_filename, _normalize_cdn_url, _fix_dotless_url
    _enrich_product = enrich_product_fn
    _sanitize_filename = sanitize_filename_fn
    _normalize_cdn_url = normalize_cdn_url_fn
    _fix_dotless_url = fix_dotless_url_fn


class FetchRequest(BaseModel):
    scope: str = Field(default="missing", pattern="^(missing|all)$")
    workers: int = Field(default=4, ge=1, le=16)
    limit: Optional[int] = Field(default=None, ge=1)


def _image_filename_from_url(url: str) -> Optional[str]:
    if not url or not _normalize_cdn_url or not _sanitize_filename:
        return None
    normalized = _normalize_cdn_url(url)
    corrected = _fix_dotless_url(normalized) if _fix_dotless_url else normalized
    return _sanitize_filename(corrected)


def _scan_local_files(category: str) -> List[Dict[str, Any]]:
    media_dir = MEDIA_ROOT / category
    if not media_dir.exists():
        return []

    items: List[Dict[str, Any]] = []
    for entry in media_dir.iterdir():
        if not entry.is_file():
            continue
        stat = entry.stat()
        items.append(
            {
                "filename": entry.name,
                "category": category,
                "size_bytes": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "url": f"/media/{category}/{entry.name}",
            }
        )
    items.sort(key=lambda x: x["modified_at"], reverse=True)
    return items


def _build_filename_index() -> Dict[str, Dict[str, Any]]:
    """Map local filename -> catalog product metadata."""
    index: Dict[str, Dict[str, Any]] = {}
    products = catalog_repo.load_live_products_for_index()
    for prod in products:
        image_url = prod.get("image") or ""
        fname = _image_filename_from_url(image_url)
        if fname and fname not in index:
            index[fname] = {
                "product_id": str(prod.get("id") or ""),
                "title_en": prod.get("title_en") or prod.get("name_en") or "",
                "title_ar": prod.get("title_ar") or prod.get("name_ar") or "",
                "cdn_url": image_url,
            }
    return index


def _compute_stats() -> Dict[str, Any]:
    local_products = _scan_local_files("products")
    local_brands = _scan_local_files("brands")
    local_product_names = {f["filename"] for f in local_products}
    local_brand_names = {f["filename"] for f in local_brands}

    catalog_with_image = 0
    catalog_local = 0
    brand_urls: set[str] = set()
    brand_local = 0

    products = catalog_repo.load_live_products_for_index()
    for prod in products:
        image_url = prod.get("image") or ""
        if image_url:
            catalog_with_image += 1
            fname = _image_filename_from_url(image_url)
            if fname and fname in local_product_names:
                catalog_local += 1

        brand = prod.get("brands") or {}
        brand_url = brand.get("images") if isinstance(brand, dict) else None
        if brand_url and brand_url not in brand_urls:
            brand_urls.add(brand_url)
            fname = _image_filename_from_url(brand_url)
            if fname and fname in local_brand_names:
                brand_local += 1

    return {
        "local_product_images": len(local_products),
        "local_brand_images": len(local_brands),
        "local_total": len(local_products) + len(local_brands),
        "catalog_products_with_image": catalog_with_image,
        "catalog_products_local": catalog_local,
        "catalog_products_missing": max(0, catalog_with_image - catalog_local),
        "catalog_brand_images": len(brand_urls),
        "catalog_brands_local": brand_local,
        "catalog_brands_missing": max(0, len(brand_urls) - brand_local),
        "media_root": str(MEDIA_ROOT),
    }


@router.get("/stats")
async def gallery_stats():
    return _compute_stats()


@router.get("/images")
async def list_gallery_images(
    category: str = Query("all", pattern="^(all|products|brands)$"),
    search: Optional[str] = None,
    limit: int = Query(48, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    if category == "all":
        items = _scan_local_files("products") + _scan_local_files("brands")
        items.sort(key=lambda x: x["modified_at"], reverse=True)
    else:
        items = _scan_local_files(category)

    filename_index = _build_filename_index()

    enriched: List[Dict[str, Any]] = []
    for item in items:
        meta = filename_index.get(item["filename"], {})
        label = meta.get("title_en") or meta.get("title_ar") or item["filename"]
        row = {**item, "label": label, "product_id": meta.get("product_id"), "cdn_url": meta.get("cdn_url")}
        if search:
            needle = search.lower()
            haystack = " ".join(
                [
                    item["filename"],
                    label,
                    meta.get("title_ar") or "",
                    meta.get("product_id") or "",
                ]
            ).lower()
            if needle not in haystack:
                continue
        enriched.append(row)

    total = len(enriched)
    page = enriched[offset : offset + limit]
    return {"total": total, "limit": limit, "offset": offset, "images": page}


@router.get("/fetch/status")
async def gallery_fetch_status():
    job = get_current_job()
    if not job:
        return {"status": "idle", "message": "No gallery fetch job has run yet"}
    return job


@router.post("/fetch")
async def start_gallery_fetch(body: FetchRequest):
    job = get_current_job()
    if job and job.get("status") in ("running", "stopping"):
        raise HTTPException(status_code=409, detail="Gallery fetch is already running")

    asyncio.create_task(
        run_gallery_fetch(scope=body.scope, workers=body.workers, limit=body.limit)
    )

    await asyncio.sleep(0.05)
    current = get_current_job()
    return current or {"status": "starting"}


@router.post("/fetch/stop")
async def stop_gallery_fetch_job():
    result = stop_gallery_fetch()
    if not result:
        raise HTTPException(status_code=404, detail="No running gallery fetch job")
    job_id = result["job_id"]
    if job_id in job_listeners:
        import json

        for queue in list(job_listeners[job_id]):
            await queue.put(f"event: progress\ndata: {json.dumps(result)}\n\n")
    return result


@router.get("/fetch/stream")
async def stream_gallery_fetch():
    job = get_current_job()
    if not job:
        raise HTTPException(status_code=404, detail="No gallery fetch job")

    job_id = job["job_id"]

    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()
        if job_id not in job_listeners:
            job_listeners[job_id] = set()
        job_listeners[job_id].add(queue)

        current = get_current_job()
        if current:
            import json

            yield f"event: progress\ndata: {json.dumps(current)}\n\n"
            if current.get("status") in ("completed", "failed", "stopped"):
                yield f"event: complete\ndata: {json.dumps(current)}\n\n"
                return

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
