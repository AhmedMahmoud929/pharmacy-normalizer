"""
Catalog refresh pipeline — crawl → import → normalize → seed mappings → promote → reload.

All persistent state lives in pharmatcher.db. Crawler subprocess may write a temp file
internally during crawl; the import step reads it and discards the dependency.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from typing import Any, Awaitable, Callable, Dict, List, Optional

from db.config import resolve_backend_root
from db import catalog_repo, mappings_repo, pipeline_repo
from db.catalog_repo import set_meta
from db.exceptions import PipelineCancelled
from db.schema import init_schema
from normalizer import normalize

ReloadIndexFn = Callable[[], Awaitable[None] | None]

DEFAULT_STEPS = ["sync_staging", "normalize", "seed_mappings", "promote", "reload_index"]
FULL_STEPS = ["crawl", "import", "normalize", "seed_mappings", "promote", "reload_index"]

_pipeline_listeners: Dict[str, List[asyncio.Queue]] = {}
_running_tasks: Dict[str, asyncio.Task] = {}
_cancelled_jobs: set[str] = set()
_cancel_cache: Dict[str, bool] = {}
_cancel_cache_at: Dict[str, float] = {}


def request_pipeline_cancel(job_id: str) -> None:
    _cancelled_jobs.add(job_id)
    _cancel_cache[job_id] = True
    _cancel_cache_at[job_id] = time.monotonic()
    pipeline_repo.set_cancel_requested(job_id)
    task = _running_tasks.get(job_id)
    if task and not task.done():
        task.cancel()


def force_cancel_pipeline(job_id: str) -> bool:
    """Stop live task (if any) and persist cancelled status immediately."""
    request_pipeline_cancel(job_id)
    job = pipeline_repo.get_pipeline_job(job_id)
    if not job or job["status"] not in ("pending", "running"):
        return False
    current = job.get("current_step")
    if current:
        pipeline_repo.update_step_progress(job_id, current, status="failed", message="Cancelled")
    pipeline_repo.update_pipeline_status(job_id, "cancelled", error_msg="Cancelled by user")
    _emit(job_id, "pipeline_cancelled", {"message": "Pipeline cancelled by user"})
    return True


def is_pipeline_cancelled(job_id: str) -> bool:
    if job_id in _cancelled_jobs:
        return True
    job = pipeline_repo.get_pipeline_job(job_id)
    if job:
        if job["status"] == "cancelled":
            _cancelled_jobs.add(job_id)
            return True
        if (job.get("progress") or {}).get("cancel_requested"):
            _cancelled_jobs.add(job_id)
            return True
    now = time.monotonic()
    if now - _cancel_cache_at.get(job_id, 0) < 0.25:
        return _cancel_cache.get(job_id, False)
    cancelled = bool((job.get("progress") or {}).get("cancel_requested")) if job else False
    _cancel_cache[job_id] = cancelled
    _cancel_cache_at[job_id] = now
    if cancelled:
        _cancelled_jobs.add(job_id)
    return cancelled


def _clear_cancel_flag(job_id: str) -> None:
    _cancelled_jobs.discard(job_id)
    _cancel_cache.pop(job_id, None)
    _cancel_cache_at.pop(job_id, None)


def _ensure_not_cancelled(job_id: str) -> None:
    if is_pipeline_cancelled(job_id):
        raise PipelineCancelled()


def _update_crawl_progress(
    job_id: str,
    *,
    message: str,
    products_found: int,
    processed_categories: int = 0,
    total_categories: int = 0,
    catalog_total: Optional[int] = None,
) -> None:
    pipeline_repo.update_step_progress(
        job_id,
        "crawl",
        status="running",
        message=message,
        processed=products_found,
        total=catalog_total,
        products_found=products_found,
        processed_categories=processed_categories,
        total_categories=total_categories,
    )
    _emit(
        job_id,
        "step_progress",
        {
            "step": "crawl",
            "message": message,
            "products_found": products_found,
            "processed": products_found,
            "total": catalog_total,
            "processed_categories": processed_categories,
            "total_categories": total_categories,
        },
    )


def _emit(job_id: str, event: str, data: Dict[str, Any]) -> None:
    payload = f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
    for q in list(_pipeline_listeners.get(job_id, [])):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass


async def run_pipeline(
    *,
    steps: Optional[List[str]] = None,
    crawl_options: Optional[Dict[str, Any]] = None,
    import_source_path: Optional[str] = None,
    reload_index_fn: Optional[ReloadIndexFn] = None,
    workspace_root: Optional[str] = None,
) -> str:
    init_schema()
    job_id = str(uuid.uuid4())
    resolved_steps = steps or DEFAULT_STEPS
    pipeline_repo.create_pipeline_job(job_id, resolved_steps, crawl_options)
    pipeline_repo.update_pipeline_status(job_id, "running")

    task = asyncio.create_task(
        _execute_pipeline(
            job_id,
            resolved_steps,
            crawl_options or {},
            import_source_path,
            reload_index_fn,
            workspace_root,
        )
    )
    _running_tasks[job_id] = task
    task.add_done_callback(lambda _t: _running_tasks.pop(job_id, None))
    return job_id


async def _execute_pipeline(
    job_id: str,
    steps: List[str],
    crawl_options: Dict[str, Any],
    import_source_path: Optional[str],
    reload_index_fn: Optional[ReloadIndexFn],
    workspace_root: Optional[str],
) -> None:
    crawl_output_path: Optional[str] = None
    try:
        for step in steps:
            _ensure_not_cancelled(job_id)
            pipeline_repo.update_step_progress(job_id, step, status="running")
            _emit(job_id, "step_start", {"step": step})

            if step == "crawl":
                crawl_output_path = await _step_crawl(job_id, crawl_options, workspace_root)
            elif step == "sync_staging":
                count = await asyncio.to_thread(catalog_repo.sync_live_to_staging)
                _ensure_not_cancelled(job_id)
                pipeline_repo.update_step_progress(job_id, step, status="completed", processed=count, total=count)
            elif step == "import":
                source = import_source_path or crawl_output_path
                count = await _step_import(source)
                _ensure_not_cancelled(job_id)
                pipeline_repo.update_step_progress(job_id, step, status="completed", processed=count, total=count)
            elif step == "normalize":
                count = await _step_normalize(job_id)
                _ensure_not_cancelled(job_id)
                pipeline_repo.update_step_progress(job_id, step, status="completed", processed=count, total=count)
            elif step == "seed_mappings":
                count = await _step_seed_mappings()
                _ensure_not_cancelled(job_id)
                pipeline_repo.update_step_progress(job_id, step, status="completed", processed=count, total=count)
            elif step == "promote":
                count = await _step_promote()
                _ensure_not_cancelled(job_id)
                pipeline_repo.update_step_progress(job_id, step, status="completed", processed=count, total=count)
            elif step == "reload_index":
                await _step_reload_index(reload_index_fn)
                _ensure_not_cancelled(job_id)
                pipeline_repo.update_step_progress(job_id, step, status="completed")
            else:
                raise ValueError(f"Unknown pipeline step: {step}")

            _emit(job_id, "step_complete", {"step": step})

        _ensure_not_cancelled(job_id)
        pipeline_repo.update_pipeline_status(job_id, "completed")
        _emit(job_id, "pipeline_complete", catalog_repo.get_catalog_stats())
    except (PipelineCancelled, asyncio.CancelledError):
        job = pipeline_repo.get_pipeline_job(job_id)
        if job and job["status"] != "cancelled":
            current = job.get("current_step")
            if current:
                pipeline_repo.update_step_progress(job_id, current, status="failed", message="Cancelled")
            pipeline_repo.update_pipeline_status(job_id, "cancelled", error_msg="Cancelled by user")
            _emit(job_id, "pipeline_cancelled", {"message": "Pipeline cancelled by user"})
    except Exception as exc:
        pipeline_repo.update_pipeline_status(job_id, "failed", error_msg=str(exc))
        _emit(job_id, "pipeline_error", {"message": str(exc)})
    finally:
        _clear_cancel_flag(job_id)


async def _step_crawl(
    job_id: str,
    crawl_options: Dict[str, Any],
    workspace_root: Optional[str],
) -> str:
    """Fetch full catalog from Chefaa Meilisearch API — no web scraping."""
    from tools.meili_catalog import fetch_all_products

    backend_root = resolve_backend_root(workspace_root)
    output_dir = os.path.join(backend_root, "data", "crawler", "jobs", job_id)
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "results.json")

    country = crawl_options.get("country", "eg")
    max_products = crawl_options.get("max_products")
    if max_products is not None:
        max_products = int(max_products)
        if max_products <= 0:
            raise ValueError("max_products must be a positive integer")

    _update_crawl_progress(
        job_id,
        message=(
            f"Fetching up to {max_products:,} products from Meilisearch API…"
            if max_products
            else "Fetching catalog from Meilisearch API…"
        ),
        products_found=0,
        catalog_total=max_products,
    )

    def on_progress(count: int, message: str) -> None:
        _ensure_not_cancelled(job_id)
        _update_crawl_progress(
            job_id,
            message=message,
            products_found=count,
            catalog_total=max_products or (count if count > 0 else None),
        )

    def should_cancel() -> bool:
        return is_pipeline_cancelled(job_id)

    try:
        products = await asyncio.to_thread(
            fetch_all_products,
            country,
            on_progress=on_progress,
            should_cancel=should_cancel,
            max_products=max_products,
        )
    except InterruptedError:
        raise PipelineCancelled() from None

    if not products:
        raise RuntimeError("Meilisearch returned zero products.")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    final_count = len(products)
    pipeline_repo.update_step_progress(
        job_id,
        "crawl",
        status="completed",
        message=f"Meilisearch fetch complete — {final_count:,} products",
        processed=final_count,
        total=final_count,
        products_found=final_count,
    )

    return output_path


async def _step_import(source_path: Optional[str]) -> int:
    if not source_path or not os.path.exists(source_path):
        raise FileNotFoundError(
            "No import source. Provide import_source_path or run the crawl step first."
        )
    with open(source_path, "r", encoding="utf-8") as f:
        products = json.load(f)
    if not isinstance(products, list):
        raise ValueError("Import source must be a JSON array of products.")
    return catalog_repo.import_products_to_staging(products)


async def _step_normalize(job_id: str) -> int:
    progress_interval = 50
    batch_size = 50

    total = await asyncio.to_thread(catalog_repo.count_unnormalized_staging)
    processed = 0

    while True:
        _ensure_not_cancelled(job_id)
        rows = await asyncio.to_thread(catalog_repo.get_unnormalized_staging_batch, batch_size)
        if not rows:
            break

        for row in rows:
            _ensure_not_cancelled(job_id)
            title = row.get("title_en") or row.get("title_ar") or ""
            if title:
                normalized = await asyncio.to_thread(normalize, title)
            else:
                normalized = str(row["id"])
            await asyncio.to_thread(
                catalog_repo.update_staging_normalized, row["id"], normalized
            )
            processed += 1
            if processed % progress_interval == 0 or processed == total:
                pipeline_repo.update_step_progress(
                    job_id, "normalize", status="running", processed=processed, total=total
                )
                _emit(
                    job_id,
                    "step_progress",
                    {"step": "normalize", "processed": processed, "total": total},
                )

        await asyncio.sleep(0)

    return processed


async def _step_seed_mappings() -> int:
    products = catalog_repo.get_staging_products()
    brand_list = []
    seen = set()
    for row in products:
        if not row.get("raw_json"):
            continue
        try:
            prod = json.loads(row["raw_json"])
        except json.JSONDecodeError:
            continue
        brands = prod.get("brands")
        if not isinstance(brands, dict):
            continue
        arabic = (brands.get("title_ar") or brands.get("name_ar") or "").strip()
        english = (brands.get("title_en") or brands.get("name_en") or "").strip()
        if arabic and english and arabic not in seen:
            seen.add(arabic)
            brand_list.append((arabic, english, "catalog_pipeline"))
    if brand_list:
        mappings_repo.bulk_insert_brands(brand_list)
    return len(brand_list)


async def _step_promote() -> int:
    count = await asyncio.to_thread(catalog_repo.promote_staging_to_live)
    set_meta("last_promoted_at", __import__("datetime").datetime.now().isoformat())
    return count


async def _step_reload_index(reload_index_fn: Optional[ReloadIndexFn]) -> None:
    if reload_index_fn is None:
        return
    result = reload_index_fn()
    if asyncio.iscoroutine(result):
        await result
