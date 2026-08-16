"""SQLite persistence for product discovery jobs."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(backend_root, "data", "extracted")
DB_PATH = os.path.join(DB_DIR, "discovery_jobs.db")
JOBS_DIR = os.path.join(backend_root, "data", "discovery", "jobs")


def init_db() -> None:
    os.makedirs(DB_DIR, exist_ok=True)
    os.makedirs(JOBS_DIR, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS discovery_jobs (
            job_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            pid INTEGER,
            filename TEXT NOT NULL,
            input_type TEXT NOT NULL,
            matcher_job_id TEXT,
            name_column TEXT,
            source_domains_json TEXT,
            total_rows INTEGER DEFAULT 0,
            processed_rows INTEGER DEFAULT 0,
            found_count INTEGER DEFAULT 0,
            review_count INTEGER DEFAULT 0,
            not_found_count INTEGER DEFAULT 0,
            imported_count INTEGER DEFAULT 0,
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
    conn.close()


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
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    results_path = os.path.join(JOBS_DIR, job_id, "results.json")
    os.makedirs(os.path.join(JOBS_DIR, job_id), exist_ok=True)

    cursor.execute(
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
            job_id,
            "pending",
            None,
            filename,
            input_type,
            matcher_job_id,
            name_column,
            json.dumps(source_domains or []),
            total_rows,
            0,
            0,
            0,
            0,
            0,
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
        "input_type": input_type,
        "matcher_job_id": matcher_job_id,
        "name_column": name_column,
        "source_domains": source_domains or [],
        "total_rows": total_rows,
        "match_threshold": match_threshold,
        "review_threshold": review_threshold,
        "created_at": now,
        "results_path": results_path,
    }


def _row_to_dict(cursor: sqlite3.Cursor, row: tuple) -> Dict[str, Any]:
    cols = [d[0] for d in cursor.description]
    data = dict(zip(cols, row))
    raw = data.get("source_domains_json")
    if raw:
        try:
            data["source_domains"] = json.loads(raw)
        except json.JSONDecodeError:
            data["source_domains"] = []
    else:
        data["source_domains"] = []
    return data


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM discovery_jobs WHERE job_id = ?", (job_id,))
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
            SELECT * FROM discovery_jobs
            WHERE status = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (status, limit, offset),
        )
    else:
        cursor.execute(
            """
            SELECT * FROM discovery_jobs
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
        "UPDATE discovery_jobs SET pid = ?, status = 'running', started_at = ? WHERE job_id = ?",
        (pid, now, job_id),
    )
    conn.commit()
    conn.close()


def update_job_progress(
    job_id: str,
    *,
    processed_rows: int,
    found_count: int,
    review_count: int,
    not_found_count: int,
) -> None:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE discovery_jobs
        SET processed_rows = ?, found_count = ?, review_count = ?, not_found_count = ?
        WHERE job_id = ?
        """,
        (processed_rows, found_count, review_count, not_found_count, job_id),
    )
    conn.commit()
    conn.close()


def update_job_counts(
    job_id: str,
    *,
    found_count: int,
    review_count: int,
    not_found_count: int,
    imported_count: int,
) -> None:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE discovery_jobs
        SET found_count = ?, review_count = ?, not_found_count = ?, imported_count = ?
        WHERE job_id = ?
        """,
        (found_count, review_count, not_found_count, imported_count, job_id),
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
        "SELECT started_at, created_at FROM discovery_jobs WHERE job_id = ?",
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
        UPDATE discovery_jobs
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
