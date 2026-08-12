"""Background image fetch for the media gallery dashboard."""

from __future__ import annotations

import asyncio
import os
import sys
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed, wait
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from db import catalog_repo

_crawler_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shefaa-crawler")
if _crawler_dir not in sys.path:
    sys.path.insert(0, _crawler_dir)

from fetch_images import DownloadResult, ImageTask, download_one, extract_tasks  # noqa: E402

_backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA_ROOT = Path(_backend_root) / "data" / "media"

job_listeners: Dict[str, Set[asyncio.Queue]] = {}


@dataclass
class GalleryJobState:
    job_id: str
    status: str = "idle"
    scope: str = "missing"
    total: int = 0
    completed: int = 0
    succeeded: int = 0
    failed: int = 0
    skipped: int = 0
    remaining: int = 0
    workers: int = 4
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    error: Optional[str] = None
    message: Optional[str] = None
    recent_logs: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "scope": self.scope,
            "total": self.total,
            "completed": self.completed,
            "succeeded": self.succeeded,
            "failed": self.failed,
            "skipped": self.skipped,
            "remaining": self.remaining,
            "workers": self.workers,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "error": self.error,
            "message": self.message,
            "recent_logs": self.recent_logs[-20:],
            "progress_pct": round((self.completed / self.total) * 100, 1) if self.total else 0,
        }


_lock = threading.Lock()
_current_job: Optional[GalleryJobState] = None
_abort = threading.Event()


def get_current_job() -> Optional[Dict[str, Any]]:
    with _lock:
        return _current_job.to_dict() if _current_job else None


def _catalog_products_for_fetch() -> List[dict]:
    products = catalog_repo.load_live_products_for_index()
    formatted: List[dict] = []
    for p in products:
        formatted.append(
            {
                "id": p.get("id"),
                "title_en": p.get("title_en") or p.get("name_en") or "",
                "title_ar": p.get("title_ar") or p.get("name_ar") or "",
                "image": p.get("image") or "",
                "brands": p.get("brands") or {},
            }
        )
    return formatted


def _filter_tasks(tasks: List[ImageTask], scope: str) -> List[ImageTask]:
    if scope == "all":
        return tasks
    return [t for t in tasks if not t.dest_path.exists()]


async def _emit(job_id: str, event: str, payload: Dict[str, Any]) -> None:
    import json

    message = f"event: {event}\ndata: {json.dumps(payload)}\n\n"
    listeners = job_listeners.get(job_id, set())
    for queue in list(listeners):
        await queue.put(message)


def _append_log(job: GalleryJobState, line: str) -> None:
    job.recent_logs.append(line)
    if len(job.recent_logs) > 50:
        job.recent_logs = job.recent_logs[-50:]


def _record_result(job: GalleryJobState, result: DownloadResult) -> None:
    job.completed += 1
    if result.skipped:
        job.skipped += 1
    elif result.success:
        job.succeeded += 1
        _append_log(job, f"OK {result.task.dest_path.name}")
    elif result.error_type != "aborted":
        job.failed += 1
        _append_log(job, f"FAIL {result.task.label[:40]} — {result.error or result.error_type}")


def _cleanup_orphan_tmp_files() -> None:
    for subdir in ("products", "brands"):
        media_dir = MEDIA_ROOT / subdir
        if not media_dir.exists():
            continue
        for tmp in media_dir.glob("*.tmp"):
            try:
                tmp.unlink()
            except OSError:
                pass


def _run_download_pool(
    job: GalleryJobState,
    tasks: List[ImageTask],
    workers: int,
    on_progress=None,
) -> None:
    def worker(task: ImageTask) -> DownloadResult:
        if _abort.is_set():
            return DownloadResult(task=task, success=False, error="aborted", error_type="aborted")
        return download_one(task)

    pool = ThreadPoolExecutor(max_workers=workers)
    futures = {pool.submit(worker, task): task for task in tasks}
    processed: set = set()

    try:
        for future in as_completed(futures):
            if future in processed:
                continue
            result: DownloadResult = future.result()
            processed.add(future)
            with _lock:
                if result.error_type != "aborted":
                    _record_result(job, result)
            if on_progress:
                on_progress()

            if _abort.is_set():
                for pending in futures:
                    if pending not in processed:
                        pending.cancel()
                break

        if _abort.is_set():
            in_flight = [f for f in futures if f not in processed and not f.cancelled()]
            if in_flight:
                done, _ = wait(in_flight, timeout=60)
                for future in done:
                    if future in processed:
                        continue
                    try:
                        result = future.result()
                    except Exception:
                        processed.add(future)
                        continue
                    processed.add(future)
                    with _lock:
                        if result.error_type != "aborted":
                            _record_result(job, result)
                    if on_progress:
                        on_progress()
    finally:
        for future in futures:
            if future not in processed:
                future.cancel()
        pool.shutdown(wait=False, cancel_futures=True)
        _cleanup_orphan_tmp_files()


async def run_gallery_fetch(
    *,
    scope: str = "missing",
    workers: int = 4,
    limit: Optional[int] = None,
) -> Dict[str, Any]:
    global _current_job

    with _lock:
        if _current_job and _current_job.status in ("running", "stopping"):
            raise RuntimeError("A gallery fetch job is already running")

        job_id = str(uuid.uuid4())
        job = GalleryJobState(job_id=job_id, status="running", scope=scope, workers=workers)
        job.started_at = datetime.now().isoformat()
        _current_job = job

    _abort.clear()

    try:
        products = await asyncio.to_thread(_catalog_products_for_fetch)
        if not products:
            with _lock:
                job.status = "failed"
                job.error = "Catalog is empty — load products first"
                job.finished_at = datetime.now().isoformat()
            await _emit(job_id, "error", job.to_dict())
            return job.to_dict()

        tasks, _ = extract_tasks(products, MEDIA_ROOT, limit)
        tasks = _filter_tasks(tasks, scope)

        with _lock:
            job.total = len(tasks)

        await _emit(job_id, "progress", job.to_dict())

        if not tasks:
            with _lock:
                job.status = "completed"
                job.finished_at = datetime.now().isoformat()
            await _emit(job_id, "complete", job.to_dict())
            return job.to_dict()

        loop = asyncio.get_running_loop()

        def on_progress() -> None:
            with _lock:
                payload = job.to_dict()
            asyncio.run_coroutine_threadsafe(_emit(job_id, "progress", payload), loop)

        await asyncio.to_thread(_run_download_pool, job, tasks, workers, on_progress)

        with _lock:
            job.remaining = max(0, job.total - job.completed)
            if _abort.is_set():
                job.status = "stopped"
                job.message = (
                    f"Stopped early. {job.succeeded} new images saved locally; "
                    f"{job.skipped} were already cached. "
                    f"Use Fetch Missing to continue where you left off."
                )
                _append_log(job, job.message)
            else:
                job.status = "completed"
                job.message = (
                    f"Done. {job.succeeded} downloaded, {job.skipped} already local, "
                    f"{job.failed} failed."
                )
            job.finished_at = datetime.now().isoformat()
            payload = job.to_dict()

        await _emit(job_id, "complete", payload)
        return payload

    except Exception as exc:
        with _lock:
            job.status = "failed"
            job.error = str(exc)
            job.finished_at = datetime.now().isoformat()
        await _emit(job_id, "error", job.to_dict())
        return job.to_dict()


def stop_gallery_fetch() -> Optional[Dict[str, Any]]:
    global _current_job

    with _lock:
        if not _current_job or _current_job.status not in ("running", "stopping"):
            return None
        _abort.set()
        _current_job.status = "stopping"
        _append_log(
            _current_job,
            "Stop requested — in-flight downloads will finish; queued items cancelled.",
        )
        return _current_job.to_dict()
