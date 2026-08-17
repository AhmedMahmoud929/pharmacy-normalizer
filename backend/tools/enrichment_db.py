"""SQLite persistence for barcode enrichment jobs."""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from db.connection import get_connection
from db.schema import init_schema

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEGACY_JOBS_DIR = os.path.join(backend_root, "data", "enrichment", "jobs")


def init_db() -> None:
    init_schema()


def create_job(
    job_id: str,
    filename: str,
    *,
    name_column: str = "",
    barcode_column: str = "",
    code_column: Optional[str] = None,
    match_threshold: float = 0.60,
    review_threshold: float = 0.40,
    total_rows: int = 0,
) -> Dict[str, Any]:
    init_db()
    now = datetime.now().isoformat()

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO enrichment_jobs (
                job_id, status, pid, filename, total_rows, processed_rows,
                matched_count, review_count, no_match_count, already_synced_count,
                applied_count, name_column, barcode_column, code_column,
                match_threshold, review_threshold, results_path, error_msg,
                created_at, started_at, finished_at, duration
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_id, "pending", None, filename, total_rows, 0,
                0, 0, 0, 0, 0, name_column, barcode_column, code_column,
                match_threshold, review_threshold, None, None,
                now, None, None, None,
            ),
        )
        conn.execute(
            "INSERT INTO enrichment_job_results (job_id, results_json, updated_at) VALUES (?, '[]', ?)",
            (job_id, now),
        )

    return {
        "job_id": job_id,
        "status": "pending",
        "filename": filename,
        "total_rows": total_rows,
        "name_column": name_column,
        "barcode_column": barcode_column,
        "code_column": code_column,
        "match_threshold": match_threshold,
        "review_threshold": review_threshold,
        "created_at": now,
    }


def _row_to_dict(row) -> Dict[str, Any]:
    data = dict(row)
    data.pop("results_path", None)
    return data


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM enrichment_jobs WHERE job_id = ?", (job_id,)).fetchone()
    return _row_to_dict(row) if row else None


def get_jobs(
    limit: int = 20,
    offset: int = 0,
    status: Optional[str] = None,
) -> List[Dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM enrichment_jobs WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (status, limit, offset),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM enrichment_jobs ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
    return [_row_to_dict(r) for r in rows]


def update_job_pid(job_id: str, pid: int) -> None:
    now = datetime.now().isoformat()
    with get_connection() as conn:
        conn.execute(
            "UPDATE enrichment_jobs SET pid = ?, status = 'running', started_at = ? WHERE job_id = ?",
            (pid, now, job_id),
        )


def update_job_progress(
    job_id: str,
    *,
    processed_rows: int,
    matched_count: int,
    review_count: int,
    no_match_count: int,
    already_synced_count: int = 0,
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE enrichment_jobs
            SET processed_rows = ?, matched_count = ?, review_count = ?,
                no_match_count = ?, already_synced_count = ?
            WHERE job_id = ?
            """,
            (processed_rows, matched_count, review_count, no_match_count, already_synced_count, job_id),
        )


def update_job_counts(
    job_id: str,
    *,
    matched_count: int,
    review_count: int,
    no_match_count: int,
    already_synced_count: int,
    applied_count: int,
    pending_apply_count: int = 0,
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE enrichment_jobs
            SET matched_count = ?, review_count = ?, no_match_count = ?,
                already_synced_count = ?, applied_count = ?, pending_apply_count = ?
            WHERE job_id = ?
            """,
            (
                matched_count, review_count, no_match_count,
                already_synced_count, applied_count, pending_apply_count, job_id,
            ),
        )


def finalize_job(job_id: str, status: str, *, error_msg: Optional[str] = None) -> None:
    now = datetime.now().isoformat()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT started_at, created_at FROM enrichment_jobs WHERE job_id = ?",
            (job_id,),
        ).fetchone()
        duration = None
        if row:
            started_at = row[0] or row[1]
            try:
                duration = int((datetime.fromisoformat(now) - datetime.fromisoformat(started_at)).total_seconds())
            except Exception:
                pass
        conn.execute(
            """
            UPDATE enrichment_jobs
            SET status = ?, error_msg = ?, finished_at = ?, duration = ?
            WHERE job_id = ?
            """,
            (status, error_msg, now, duration, job_id),
        )


def _legacy_results_path(job_id: str, job: Optional[Dict[str, Any]] = None) -> Optional[str]:
    if job and job.get("results_path"):
        path = job["results_path"]
        if path and os.path.exists(path):
            return path
    default = os.path.join(LEGACY_JOBS_DIR, job_id, "results.json")
    return default if os.path.exists(default) else None


def _cleanup_legacy_file(path: str) -> None:
    try:
        os.remove(path)
        parent = os.path.dirname(path)
        if os.path.isdir(parent) and not os.listdir(parent):
            os.rmdir(parent)
    except OSError:
        pass


def save_results(job_id: str, results: List[Dict[str, Any]]) -> None:
    init_db()
    if not get_job(job_id):
        raise FileNotFoundError(f"Job {job_id} not found")
    now = datetime.now().isoformat()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO enrichment_job_results (job_id, results_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                results_json = excluded.results_json,
                updated_at = excluded.updated_at
            """,
            (job_id, json.dumps(results, ensure_ascii=False), now),
        )


def _migrate_legacy_results(job_id: str) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute("SELECT results_path FROM enrichment_jobs WHERE job_id = ?", (job_id,)).fetchone()
    legacy_path = _legacy_results_path(job_id, {"results_path": row[0] if row else None})
    if not legacy_path:
        return []
    try:
        with open(legacy_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            return []
        save_results(job_id, data)
        _cleanup_legacy_file(legacy_path)
        return data
    except Exception:
        return []


def load_results(job_id: str) -> List[Dict[str, Any]]:
    init_db()
    job = get_job(job_id)
    if not job:
        raise FileNotFoundError(f"Job {job_id} not found")

    with get_connection() as conn:
        legacy_row = conn.execute("SELECT results_path FROM enrichment_jobs WHERE job_id = ?", (job_id,)).fetchone()
        row = conn.execute(
            "SELECT results_json FROM enrichment_job_results WHERE job_id = ?",
            (job_id,),
        ).fetchone()

    if row and row[0]:
        try:
            data = json.loads(row[0])
            if isinstance(data, list):
                legacy = _legacy_results_path(job_id, {"results_path": legacy_row[0] if legacy_row else None})
                if legacy:
                    _cleanup_legacy_file(legacy)
                return data
        except json.JSONDecodeError:
            pass

    return _migrate_legacy_results(job_id)


def recount_stats(results: List[Dict[str, Any]]) -> Dict[str, int]:
    matched = review = no_match = already = applied = pending_apply = 0
    for item in results:
        status = item.get("enrichment_status") or "no_match"
        apply_status = item.get("apply_status") or "pending"
        if status == "matched":
            matched += 1
            if apply_status == "pending":
                pending_apply += 1
        elif status == "review":
            review += 1
        elif status == "already_synced":
            already += 1
        else:
            no_match += 1
        if apply_status in ("applied", "overridden"):
            applied += 1
    return {
        "matched_count": matched,
        "review_count": review,
        "no_match_count": no_match,
        "already_synced_count": already,
        "applied_count": applied,
        "pending_apply_count": pending_apply,
    }
