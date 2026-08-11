"""SQLite persistence for barcode enrichment jobs."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(backend_root, "data", "extracted")
DB_PATH = os.path.join(DB_DIR, "enrichment_jobs.db")
JOBS_DIR = os.path.join(backend_root, "data", "enrichment", "jobs")


def init_db() -> None:
    os.makedirs(DB_DIR, exist_ok=True)
    os.makedirs(JOBS_DIR, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS enrichment_jobs (
            job_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            pid INTEGER,
            filename TEXT NOT NULL,
            total_rows INTEGER DEFAULT 0,
            processed_rows INTEGER DEFAULT 0,
            matched_count INTEGER DEFAULT 0,
            review_count INTEGER DEFAULT 0,
            no_match_count INTEGER DEFAULT 0,
            already_synced_count INTEGER DEFAULT 0,
            applied_count INTEGER DEFAULT 0,
            pending_apply_count INTEGER DEFAULT 0,
            name_column TEXT,
            barcode_column TEXT,
            code_column TEXT,
            match_threshold REAL,
            review_threshold REAL,
            results_path TEXT,
            error_msg TEXT,
            created_at TEXT NOT NULL,
            started_at TEXT,
            finished_at TEXT,
            duration INTEGER
        )
        """
    )
    conn.commit()

    for col_name, col_type in [
        ("pending_apply_count", "INTEGER DEFAULT 0"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE enrichment_jobs ADD COLUMN {col_name} {col_type}")
            conn.commit()
        except sqlite3.OperationalError:
            pass

    conn.close()


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
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    results_path = os.path.join(JOBS_DIR, job_id, "results.json")
    os.makedirs(os.path.join(JOBS_DIR, job_id), exist_ok=True)

    cursor.execute(
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
            job_id,
            "pending",
            None,
            filename,
            total_rows,
            0,
            0,
            0,
            0,
            0,
            0,
            name_column,
            barcode_column,
            code_column,
            match_threshold,
            review_threshold,
            results_path,
            None,
            now,
            None,
            None,
            None,
        ),
    )
    conn.commit()
    conn.close()

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
        "results_path": results_path,
    }


def _row_to_dict(cursor: sqlite3.Cursor, row: tuple) -> Dict[str, Any]:
    cols = [d[0] for d in cursor.description]
    data = dict(zip(cols, row))
    return data


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM enrichment_jobs WHERE job_id = ?", (job_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    data = _row_to_dict(cursor, row)
    conn.close()
    return data


def get_jobs(
    limit: int = 20,
    offset: int = 0,
    status: Optional[str] = None,
) -> List[Dict[str, Any]]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    if status:
        cursor.execute(
            """
            SELECT * FROM enrichment_jobs
            WHERE status = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (status, limit, offset),
        )
    else:
        cursor.execute(
            """
            SELECT * FROM enrichment_jobs
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        )
    rows = cursor.fetchall()
    result = [_row_to_dict(cursor, r) for r in rows]
    conn.close()
    return result


def update_job_pid(job_id: str, pid: int) -> None:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "UPDATE enrichment_jobs SET pid = ?, status = 'running', started_at = ? WHERE job_id = ?",
        (pid, now, job_id),
    )
    conn.commit()
    conn.close()


def update_job_progress(
    job_id: str,
    *,
    processed_rows: int,
    matched_count: int,
    review_count: int,
    no_match_count: int,
    already_synced_count: int = 0,
) -> None:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE enrichment_jobs
        SET processed_rows = ?, matched_count = ?, review_count = ?,
            no_match_count = ?, already_synced_count = ?
        WHERE job_id = ?
        """,
        (
            processed_rows,
            matched_count,
            review_count,
            no_match_count,
            already_synced_count,
            job_id,
        ),
    )
    conn.commit()
    conn.close()


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
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE enrichment_jobs
        SET matched_count = ?, review_count = ?, no_match_count = ?,
            already_synced_count = ?, applied_count = ?, pending_apply_count = ?
        WHERE job_id = ?
        """,
        (
            matched_count,
            review_count,
            no_match_count,
            already_synced_count,
            applied_count,
            pending_apply_count,
            job_id,
        ),
    )
    conn.commit()
    conn.close()


def finalize_job(
    job_id: str,
    status: str,
    *,
    error_msg: Optional[str] = None,
) -> None:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "SELECT started_at, created_at FROM enrichment_jobs WHERE job_id = ?",
        (job_id,),
    )
    row = cursor.fetchone()
    duration = None
    if row:
        started_at = row[0] or row[1]
        try:
            start_dt = datetime.fromisoformat(started_at)
            end_dt = datetime.fromisoformat(now)
            duration = int((end_dt - start_dt).total_seconds())
        except Exception:
            pass

    cursor.execute(
        """
        UPDATE enrichment_jobs
        SET status = ?, error_msg = ?, finished_at = ?, duration = ?
        WHERE job_id = ?
        """,
        (status, error_msg, now, duration, job_id),
    )
    conn.commit()
    conn.close()


def load_results(job_id: str) -> List[Dict[str, Any]]:
    job = get_job(job_id)
    if not job:
        raise FileNotFoundError(f"Job {job_id} not found")
    results_path = job.get("results_path")
    if not results_path or not os.path.exists(results_path):
        return []
    with open(results_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        return []
    return data


def save_results(job_id: str, results: List[Dict[str, Any]]) -> str:
    job = get_job(job_id)
    if not job:
        raise FileNotFoundError(f"Job {job_id} not found")
    results_path = job["results_path"]
    os.makedirs(os.path.dirname(results_path), exist_ok=True)
    temp_path = results_path + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    os.replace(temp_path, results_path)
    return results_path


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
