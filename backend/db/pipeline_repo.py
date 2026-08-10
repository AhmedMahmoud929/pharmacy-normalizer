"""Catalog pipeline job persistence."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from db.connection import get_connection
from db.schema import init_schema


def _now_iso() -> str:
    return datetime.now().isoformat()


def create_pipeline_job(
    job_id: str,
    steps: List[str],
    crawl_options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    init_schema()
    now = _now_iso()
    progress = {"steps": {s: {"status": "pending"} for s in steps}}
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO catalog_pipeline_jobs
            (job_id, status, current_step, steps_json, progress_json, created_at)
            VALUES (?, 'pending', NULL, ?, ?, ?)
            """,
            (job_id, json.dumps(steps), json.dumps(progress), now),
        )
    return get_pipeline_job(job_id)


def get_pipeline_job(job_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM catalog_pipeline_jobs WHERE job_id = ?",
            (job_id,),
        ).fetchone()
    if not row:
        return None
    return _row_to_dict(dict(row))


def _row_to_dict(row: Dict[str, Any]) -> Dict[str, Any]:
    row["steps"] = json.loads(row.pop("steps_json") or "[]")
    row["progress"] = json.loads(row.pop("progress_json") or "{}")
    return row


def set_cancel_requested(job_id: str) -> None:
    job = get_pipeline_job(job_id)
    if not job:
        return
    progress = job.get("progress") or {}
    progress["cancel_requested"] = True
    with get_connection() as conn:
        conn.execute(
            "UPDATE catalog_pipeline_jobs SET progress_json = ? WHERE job_id = ?",
            (json.dumps(progress), job_id),
        )


def update_pipeline_status(
    job_id: str,
    status: str,
    *,
    current_step: Optional[str] = None,
    error_msg: Optional[str] = None,
    crawl_job_id: Optional[str] = None,
) -> None:
    now = _now_iso()
    fields = ["status = ?"]
    params: list[Any] = [status]

    if current_step is not None:
        fields.append("current_step = ?")
        params.append(current_step)
    if error_msg is not None:
        fields.append("error_msg = ?")
        params.append(error_msg)
    if crawl_job_id is not None:
        fields.append("crawl_job_id = ?")
        params.append(crawl_job_id)
    if status == "running":
        fields.append("started_at = COALESCE(started_at, ?)")
        params.append(now)
    if status in ("completed", "failed", "cancelled"):
        fields.append("finished_at = ?")
        params.append(now)

    params.append(job_id)
    with get_connection() as conn:
        conn.execute(
            f"UPDATE catalog_pipeline_jobs SET {', '.join(fields)} WHERE job_id = ?",
            params,
        )


def update_step_progress(
    job_id: str,
    step: str,
    *,
    status: str,
    message: Optional[str] = None,
    processed: Optional[int] = None,
    total: Optional[int] = None,
    products_found: Optional[int] = None,
    processed_categories: Optional[int] = None,
    total_categories: Optional[int] = None,
) -> None:
    job = get_pipeline_job(job_id)
    if not job:
        return
    progress = job.get("progress") or {}
    steps = progress.setdefault("steps", {})
    step_data = steps.setdefault(step, {})
    step_data["status"] = status
    if message is not None:
        step_data["message"] = message
    if processed is not None:
        step_data["processed"] = processed
    if total is not None:
        step_data["total"] = total
    if products_found is not None:
        step_data["products_found"] = products_found
    if processed_categories is not None:
        step_data["processed_categories"] = processed_categories
    if total_categories is not None:
        step_data["total_categories"] = total_categories
    if status == "running" and "started_at" not in step_data:
        step_data["started_at"] = _now_iso()
    if status in ("completed", "failed"):
        step_data["finished_at"] = _now_iso()

    with get_connection() as conn:
        conn.execute(
            "UPDATE catalog_pipeline_jobs SET progress_json = ?, current_step = ? WHERE job_id = ?",
            (json.dumps(progress), step, job_id),
        )


def list_pipeline_jobs(limit: int = 20, offset: int = 0) -> Dict[str, Any]:
    with get_connection() as conn:
        total_row = conn.execute("SELECT COUNT(*) AS c FROM catalog_pipeline_jobs").fetchone()
        cur = conn.execute(
            """
            SELECT * FROM catalog_pipeline_jobs
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        )
        jobs = [_row_to_dict(dict(r)) for r in cur.fetchall()]
    return {
        "total": int(total_row["c"]) if total_row else 0,
        "limit": limit,
        "offset": offset,
        "jobs": jobs,
    }
