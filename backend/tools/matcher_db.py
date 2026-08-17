import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from db.connection import get_connection
from db.schema import init_schema

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(backend_root, "data", "extracted")
LEGACY_JOBS_DIR = os.path.join(backend_root, "data", "matcher", "jobs")
EXPORT_DIR = os.path.join(DB_DIR, "matcher_exports")


def init_db() -> None:
    init_schema()
    os.makedirs(EXPORT_DIR, exist_ok=True)


def create_job(
    job_id: str,
    filename: str,
    column_used: str,
    match_threshold: float,
    review_threshold: float,
    total_rows: int = 0,
    use_uploaded_price: bool = False,
    price_column: Optional[str] = None,
    use_uploaded_stock: bool = False,
    stock_column: Optional[str] = None,
    default_stock: int = 10,
    use_uploaded_code: bool = False,
    code_column: Optional[str] = None,
    use_uploaded_international_barcode: bool = False,
    international_barcode_column: Optional[str] = None,
    match_with_international_barcode: bool = False,
    match_international_barcode_column: Optional[str] = None,
    match_with_code: bool = False,
    match_pos_code_column: Optional[str] = None,
    skip_normalizer: bool = False,
) -> Dict[str, Any]:
    init_db()
    now = datetime.now().isoformat()

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO matcher_jobs
            (job_id, status, pid, filename, total_rows, processed_rows, matched_count, review_count, no_match_count, column_used, match_threshold, review_threshold, output_path, results_path, error_msg, created_at, started_at, finished_at, duration, use_uploaded_price, price_column, use_uploaded_stock, stock_column, default_stock, use_uploaded_code, code_column, use_uploaded_international_barcode, international_barcode_column, match_with_international_barcode, match_international_barcode_column, match_with_code, match_pos_code_column, skip_normalizer)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_id, "pending", None, filename, total_rows, 0, 0, 0, 0, column_used,
                match_threshold, review_threshold, None, None, None, now, None, None, None,
                1 if use_uploaded_price else 0, price_column,
                1 if use_uploaded_stock else 0, stock_column, default_stock,
                1 if use_uploaded_code else 0, code_column,
                1 if use_uploaded_international_barcode else 0, international_barcode_column,
                1 if match_with_international_barcode else 0, match_international_barcode_column,
                1 if match_with_code else 0, match_pos_code_column,
                1 if skip_normalizer else 0,
            ),
        )
        cursor.execute(
            "INSERT INTO matcher_job_results (job_id, results_json, updated_at) VALUES (?, '[]', ?)",
            (job_id, now),
        )

    return {
        "job_id": job_id,
        "status": "pending",
        "filename": filename,
        "total_rows": total_rows,
        "column_used": column_used,
        "match_threshold": match_threshold,
        "review_threshold": review_threshold,
        "created_at": now,
        "use_uploaded_price": use_uploaded_price,
        "price_column": price_column,
        "use_uploaded_stock": use_uploaded_stock,
        "stock_column": stock_column,
        "default_stock": default_stock,
        "use_uploaded_code": use_uploaded_code,
        "code_column": code_column,
        "use_uploaded_international_barcode": use_uploaded_international_barcode,
        "international_barcode_column": international_barcode_column,
        "match_with_international_barcode": match_with_international_barcode,
        "match_international_barcode_column": match_international_barcode_column,
        "match_with_code": match_with_code,
        "match_pos_code_column": match_pos_code_column,
        "skip_normalizer": skip_normalizer,
    }


def update_job_pid(job_id: str, pid: int) -> None:
    now = datetime.now().isoformat()
    with get_connection() as conn:
        conn.execute(
            "UPDATE matcher_jobs SET pid = ?, status = 'running', started_at = ? WHERE job_id = ?",
            (pid, now, job_id),
        )


def update_job_progress(
    job_id: str,
    processed_rows: int,
    matched_count: int,
    review_count: int,
    no_match_count: int,
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE matcher_jobs
            SET processed_rows = ?, matched_count = ?, review_count = ?, no_match_count = ?
            WHERE job_id = ?
            """,
            (processed_rows, matched_count, review_count, no_match_count, job_id),
        )


def finalize_job(
    job_id: str,
    status: str,
    output_path: Optional[str] = None,
    error_msg: Optional[str] = None,
) -> None:
    now = datetime.now().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT started_at, created_at FROM matcher_jobs WHERE job_id = ?", (job_id,))
        row = cursor.fetchone()
        duration = None
        if row:
            started_at = row[0] or row[1]
            try:
                duration = int((datetime.fromisoformat(now) - datetime.fromisoformat(started_at)).total_seconds())
            except Exception:
                pass
        cursor.execute(
            """
            UPDATE matcher_jobs
            SET status = ?, output_path = ?, error_msg = ?, finished_at = ?, duration = ?
            WHERE job_id = ?
            """,
            (status, output_path, error_msg, now, duration, job_id),
        )


def update_job_totals(job_id: str, matched_count: int, review_count: int, no_match_count: int) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE matcher_jobs SET matched_count = ?, review_count = ?, no_match_count = ? WHERE job_id = ?",
            (matched_count, review_count, no_match_count, job_id),
        )


def _job_from_row(row) -> Dict[str, Any]:
    return {
        "job_id": row[0],
        "status": row[1],
        "pid": row[2],
        "filename": row[3],
        "total_rows": row[4],
        "processed_rows": row[5],
        "matched_count": row[6],
        "review_count": row[7],
        "no_match_count": row[8],
        "column_used": row[9],
        "match_threshold": row[10],
        "review_threshold": row[11],
        "output_path": row[12],
        "error_msg": row[14],
        "created_at": row[15],
        "started_at": row[16],
        "finished_at": row[17],
        "duration": row[18],
        "use_uploaded_price": bool(row[19]),
        "price_column": row[20],
        "use_uploaded_stock": bool(row[21]),
        "stock_column": row[22],
        "default_stock": row[23],
        "use_uploaded_code": bool(row[24]),
        "code_column": row[25],
        "use_uploaded_international_barcode": bool(row[26]),
        "international_barcode_column": row[27],
        "match_with_international_barcode": bool(row[28]),
        "match_international_barcode_column": row[29],
        "match_with_code": bool(row[30]),
        "match_pos_code_column": row[31],
        "skip_normalizer": bool(row[32]),
    }


_JOB_SELECT = """
    SELECT job_id, status, pid, filename, total_rows, processed_rows,
           matched_count, review_count, no_match_count, column_used,
           match_threshold, review_threshold, output_path, results_path,
           error_msg, created_at, started_at, finished_at, duration,
           use_uploaded_price, price_column, use_uploaded_stock, stock_column, default_stock,
           use_uploaded_code, code_column, use_uploaded_international_barcode, international_barcode_column,
           match_with_international_barcode, match_international_barcode_column, match_with_code, match_pos_code_column,
           skip_normalizer
    FROM matcher_jobs
"""


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        row = conn.execute(f"{_JOB_SELECT} WHERE job_id = ?", (job_id,)).fetchone()
    return _job_from_row(row) if row else None


def get_jobs(limit: int = 20, offset: int = 0, status: Optional[str] = None) -> Dict[str, Any]:
    init_db()
    with get_connection() as conn:
        if status:
            total = conn.execute("SELECT COUNT(*) FROM matcher_jobs WHERE status = ?", (status,)).fetchone()[0]
            rows = conn.execute(
                f"{_JOB_SELECT} WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (status, limit, offset),
            ).fetchall()
        else:
            total = conn.execute("SELECT COUNT(*) FROM matcher_jobs").fetchone()[0]
            rows = conn.execute(
                f"{_JOB_SELECT} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
    return {"total": total, "limit": limit, "offset": offset, "jobs": [_job_from_row(r) for r in rows]}


def delete_job(job_id: str) -> None:
    init_db()
    with get_connection() as conn:
        row = conn.execute("SELECT output_path FROM matcher_jobs WHERE job_id = ?", (job_id,)).fetchone()
        if row and row[0] and os.path.exists(row[0]):
            try:
                os.remove(row[0])
            except OSError:
                pass
        conn.execute("DELETE FROM matcher_job_results WHERE job_id = ?", (job_id,))
        conn.execute("DELETE FROM matcher_jobs WHERE job_id = ?", (job_id,))


def export_path_for_job(job_id: str) -> str:
    return os.path.join(EXPORT_DIR, f"{job_id}.xlsx")


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
            INSERT INTO matcher_job_results (job_id, results_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                results_json = excluded.results_json,
                updated_at = excluded.updated_at
            """,
            (job_id, json.dumps(results, ensure_ascii=False), now),
        )


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
        legacy_row = conn.execute("SELECT results_path FROM matcher_jobs WHERE job_id = ?", (job_id,)).fetchone()
        legacy_path = legacy_row[0] if legacy_row else None
        row = conn.execute("SELECT results_json FROM matcher_job_results WHERE job_id = ?", (job_id,)).fetchone()

    if row and row[0]:
        try:
            data = json.loads(row[0])
            if isinstance(data, list):
                legacy = _legacy_results_path(job_id, {"results_path": legacy_path})
                if legacy:
                    _cleanup_legacy_file(legacy)
                return data
        except json.JSONDecodeError:
            pass

    return _migrate_legacy_results(job_id, {"results_path": legacy_path})
