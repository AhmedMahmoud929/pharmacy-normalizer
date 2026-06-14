import sqlite3
import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

# Constants
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(backend_root, "data", "extracted")
DB_PATH = os.path.join(DB_DIR, "matcher_jobs.db")
JOBS_DIR = os.path.join(backend_root, "data", "matcher", "jobs")

def init_db():
    """Initialize the SQLite database and create tables if they do not exist."""
    os.makedirs(DB_DIR, exist_ok=True)
    os.makedirs(JOBS_DIR, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS matcher_jobs (
            job_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            pid INTEGER,
            filename TEXT NOT NULL,
            total_rows INTEGER DEFAULT 0,
            processed_rows INTEGER DEFAULT 0,
            matched_count INTEGER DEFAULT 0,
            review_count INTEGER DEFAULT 0,
            no_match_count INTEGER DEFAULT 0,
            column_used TEXT,
            match_threshold REAL,
            review_threshold REAL,
            output_path TEXT,
            results_path TEXT,
            error_msg TEXT,
            created_at TEXT NOT NULL,
            started_at TEXT,
            finished_at TEXT,
            duration INTEGER
        )
    """)
    conn.commit()
    
    # Ensure columns exist (handling legacy schema upgrades cleanly)
    for col_name, col_type in [
        ("use_uploaded_price", "INTEGER DEFAULT 0"),
        ("price_column", "TEXT"),
        ("use_uploaded_stock", "INTEGER DEFAULT 0"),
        ("stock_column", "TEXT"),
        ("default_stock", "INTEGER DEFAULT 10"),
        ("use_uploaded_code", "INTEGER DEFAULT 0"),
        ("code_column", "TEXT"),
        ("use_uploaded_international_barcode", "INTEGER DEFAULT 0"),
        ("international_barcode_column", "TEXT")
    ]:
        try:
            cursor.execute(f"ALTER TABLE matcher_jobs ADD COLUMN {col_name} {col_type}")
            conn.commit()
        except sqlite3.OperationalError:
            # Column already exists
            pass
            
    conn.close()

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
    international_barcode_column: Optional[str] = None
) -> Dict[str, Any]:
    """Register a new drug matcher job in the SQLite history database."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    now = datetime.now().isoformat()
    results_path = os.path.join(JOBS_DIR, job_id, "results.json")
    
    cursor.execute(
        """
        INSERT INTO matcher_jobs 
        (job_id, status, pid, filename, total_rows, processed_rows, matched_count, review_count, no_match_count, column_used, match_threshold, review_threshold, output_path, results_path, error_msg, created_at, started_at, finished_at, duration, use_uploaded_price, price_column, use_uploaded_stock, stock_column, default_stock, use_uploaded_code, code_column, use_uploaded_international_barcode, international_barcode_column)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            column_used,
            match_threshold,
            review_threshold,
            None,
            results_path,
            None,
            now,
            None,
            None,
            None,
            1 if use_uploaded_price else 0,
            price_column,
            1 if use_uploaded_stock else 0,
            stock_column,
            default_stock,
            1 if use_uploaded_code else 0,
            code_column,
            1 if use_uploaded_international_barcode else 0,
            international_barcode_column
        )
    )
    
    # Pre-create workspace directory for job results
    os.makedirs(os.path.join(JOBS_DIR, job_id), exist_ok=True)
    
    conn.commit()
    conn.close()
    
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
        "international_barcode_column": international_barcode_column
    }

def update_job_pid(job_id: str, pid: int):
    """Register OS Process ID and switch state to running."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "UPDATE matcher_jobs SET pid = ?, status = 'running', started_at = ? WHERE job_id = ?",
        (pid, now, job_id)
    )
    conn.commit()
    conn.close()

def update_job_progress(
    job_id: str,
    processed_rows: int,
    matched_count: int,
    review_count: int,
    no_match_count: int
):
    """Update ongoing mapping stats dynamically."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE matcher_jobs 
        SET processed_rows = ?, matched_count = ?, review_count = ?, no_match_count = ?
        WHERE job_id = ?
        """,
        (processed_rows, matched_count, review_count, no_match_count, job_id)
    )
    conn.commit()
    conn.close()

def finalize_job(
    job_id: str,
    status: str,
    output_path: Optional[str] = None,
    error_msg: Optional[str] = None
):
    """Finalize a matching session, noting finish bounds and runtime runtime duration."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    # Calculate duration
    cursor.execute("SELECT started_at, created_at FROM matcher_jobs WHERE job_id = ?", (job_id,))
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
        UPDATE matcher_jobs 
        SET status = ?, output_path = ?, error_msg = ?, finished_at = ?, duration = ?
        WHERE job_id = ?
        """,
        (status, output_path, error_msg, now, duration, job_id)
    )
    conn.commit()
    conn.close()

def update_job_totals(
    job_id: str,
    matched_count: int,
    review_count: int,
    no_match_count: int
):
    """Recompute summary counts manually (e.g. after user overrides matching rows)."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE matcher_jobs 
        SET matched_count = ?, review_count = ?, no_match_count = ?
        WHERE job_id = ?
        """,
        (matched_count, review_count, no_match_count, job_id)
    )
    conn.commit()
    conn.close()

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve details of a single mapping job session."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute(
        """
        SELECT job_id, status, pid, filename, total_rows, processed_rows, 
               matched_count, review_count, no_match_count, column_used, 
               match_threshold, review_threshold, output_path, results_path, 
               error_msg, created_at, started_at, finished_at, duration,
               use_uploaded_price, price_column, use_uploaded_stock, stock_column, default_stock,
               use_uploaded_code, code_column, use_uploaded_international_barcode, international_barcode_column
        FROM matcher_jobs WHERE job_id = ?
        """,
        (job_id,)
    )
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
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
        "results_path": row[13],
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
        "international_barcode_column": row[27]
    }

def get_jobs(limit: int = 20, offset: int = 0, status: Optional[str] = None) -> Dict[str, Any]:
    """Retrieve a paginated history list of all match campaigns."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    query = """
        SELECT job_id, status, pid, filename, total_rows, processed_rows, 
               matched_count, review_count, no_match_count, column_used, 
               match_threshold, review_threshold, output_path, results_path, 
               error_msg, created_at, started_at, finished_at, duration,
               use_uploaded_price, price_column, use_uploaded_stock, stock_column, default_stock,
               use_uploaded_code, code_column, use_uploaded_international_barcode, international_barcode_column
        FROM matcher_jobs
    """
    count_query = "SELECT COUNT(*) FROM matcher_jobs"
    args = []
    
    if status:
        query += " WHERE status = ?"
        count_query += " WHERE status = ?"
        args.append(status)
        
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    args.extend([limit, offset])
    
    cursor.execute(count_query, [status] if status else [])
    total = cursor.fetchone()[0]
    
    cursor.execute(query, args)
    rows = cursor.fetchall()
    conn.close()
    
    jobs = []
    for row in rows:
        jobs.append({
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
            "results_path": row[13],
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
            "international_barcode_column": row[27]
        })
        
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "jobs": jobs
    }

def delete_job(job_id: str):
    """Delete a mapping job session from SQLite and remove its workspace files from disk."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Query results_path and output_path to clean up files
    cursor.execute("SELECT results_path, output_path FROM matcher_jobs WHERE job_id = ?", (job_id,))
    row = cursor.fetchone()
    
    if row:
        results_path, output_path = row
        # Clean up files inside the job's directory
        path_to_clean = results_path or output_path
        if path_to_clean:
            job_dir = os.path.dirname(path_to_clean)
            if os.path.exists(job_dir):
                import shutil
                try:
                    shutil.rmtree(job_dir)
                except Exception as e:
                    print(f"Failed to remove job folder {job_dir}: {e}")
                    
    cursor.execute("DELETE FROM matcher_jobs WHERE job_id = ?", (job_id,))
    conn.commit()
    conn.close()
