"""SQLite persistence for product discovery jobs."""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from db.connection import get_connection
from db.schema import init_schema

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEGACY_JOBS_DIR = os.path.join(backend_root, "data", "discovery", "jobs")


def init_db() -> None:
    init_schema()


def create_job(
    job_id: str,
    filename: str,
    *,
    input_type: str,
    matcher_job_id: Optional[str] = None,
    name_column: str = "",
    source_domains: Optional[List[str]] = None,
    match_threshold: float = 0.60,
    review_threshold: float = 0.40,
    total_rows: int = 0,
) -> Dict[str, Any]:
    init_db()
    now = datetime.now().isoformat()

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO discovery_jobs (
                job_id, status, pid, filename, input_type, matcher_job_id,
                name_column, source_domains_json, total_rows, processed_rows,
                found_count, review_count, not_found_count, imported_count,
                match_threshold, review_threshold, results_path, error_msg,
                created_at, started_at, finished_at, duration
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_id, "pending", None, filename, input_type, matcher_job_id,
                name_column, json.dumps(source_domains or []), total_rows, 0,
                0, 0, 0, 0, match_threshold, review_threshold, None, None,
                now, None, None, None,
            ),
        )
        conn.execute(
            "INSERT INTO discovery_job_results (job_id, results_json, updated_at) VALUES (?, '[]', ?)",
            (job_id, now),
        )

    return {
        "job_id": job_id,
        "status": "pending",
        "filename": filename,
        "input_type": input_type,
        "matcher_job_id": matcher_job_id,
        "name_column": name_column,
        "source_domains": source_domains or [],
        "total_rows": total_rows,
        "match_threshold": match_threshold,
        "review_threshold": review_threshold,
        "created_at": now,
    }


def _row_to_dict(row) -> Dict[str, Any]:
    data = dict(row)
    raw = data.get("source_domains_json")
    if raw:
        try:
            data["source_domains"] = json.loads(raw)
        except json.JSONDecodeError:
            data["source_domains"] = []
    else:
        data["source_domains"] = []
    data.pop("results_path", None)
    data.pop("source_domains_json", None)
    return data


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM discovery_jobs WHERE job_id = ?", (job_id,)).fetchone()
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
                "SELECT * FROM discovery_jobs WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (status, limit, offset),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM discovery_jobs ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
    return [_row_to_dict(r) for r in rows]


def update_job_pid(job_id: str, pid: int) -> None:
    now = datetime.now().isoformat()
    with get_connection() as conn:
        conn.execute(
            "UPDATE discovery_jobs SET pid = ?, status = 'running', started_at = ? WHERE job_id = ?",
            (pid, now, job_id),
        )


def update_job_progress(
    job_id: str,
    *,
    processed_rows: int,
    found_count: int,
    review_count: int,
    not_found_count: int,
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE discovery_jobs
            SET processed_rows = ?, found_count = ?, review_count = ?, not_found_count = ?
            WHERE job_id = ?
            """,
            (processed_rows, found_count, review_count, not_found_count, job_id),
        )


def update_job_counts(
    job_id: str,
    *,
    found_count: int,
    review_count: int,
    not_found_count: int,
    imported_count: int,
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE discovery_jobs
            SET found_count = ?, review_count = ?, not_found_count = ?, imported_count = ?
            WHERE job_id = ?
            """,
            (found_count, review_count, not_found_count, imported_count, job_id),
        )


def finalize_job(job_id: str, status: str, *, error_msg: Optional[str] = None) -> None:
    now = datetime.now().isoformat()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT started_at, created_at FROM discovery_jobs WHERE job_id = ?",
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
            UPDATE discovery_jobs
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


def _migrate_legacy_results(job_id: str, job: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    path = _legacy_results_path(job_id, job)
    if not path:
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            return []
        save_results(job_id, data)
        _cleanup_legacy_file(path)
        return data
    except Exception:
        return []


def load_results(job_id: str) -> List[Dict[str, Any]]:
    init_db()
    job = get_job(job_id)
    if not job:
        raise FileNotFoundError(f"Job {job_id} not found")

    with get_connection() as conn:
        row = conn.execute(
            "SELECT results_json FROM discovery_job_results WHERE job_id = ?",
            (job_id,),
        ).fetchone()

    if row and row[0]:
        try:
            data = json.loads(row[0])
            if isinstance(data, list):
                legacy_path = _legacy_results_path(job_id, job)
                if legacy_path:
                    _cleanup_legacy_file(legacy_path)
                return data
        except json.JSONDecodeError:
            pass

    migrated = _migrate_legacy_results(job_id, job)
    return migrated if migrated else []


def save_results(job_id: str, results: List[Dict[str, Any]]) -> None:
    init_db()
    if not get_job(job_id):
        raise FileNotFoundError(f"Job {job_id} not found")
    now = datetime.now().isoformat()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO discovery_job_results (job_id, results_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                results_json = excluded.results_json,
                updated_at = excluded.updated_at
            """,
            (job_id, json.dumps(results, ensure_ascii=False), now),
        )


def recount_stats(results: List[Dict[str, Any]]) -> Dict[str, int]:
    found = review = not_found = imported = 0
    for item in results:
        status = item.get("discovery_status") or "not_found"
        if status == "found":
            found += 1
        elif status == "review":
            review += 1
        else:
            not_found += 1
        if item.get("import_status") == "imported":
            imported += 1
    return {
        "found_count": found,
        "review_count": review,
        "not_found_count": not_found,
        "imported_count": imported,
    }
