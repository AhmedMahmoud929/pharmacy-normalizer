import sqlite3
import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

# Constants
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(backend_root, "data", "extracted")
DB_PATH = os.path.join(DB_DIR, "crawler_jobs.db")
JOBS_DIR = os.path.join(DB_DIR, "crawler", "jobs")

def init_db():
    """Initialize the SQLite database and create tables if they do not exist."""
    os.makedirs(DB_DIR, exist_ok=True)
    os.makedirs(JOBS_DIR, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS crawler_jobs (
            job_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            pid INTEGER,
            target TEXT NOT NULL,
            params TEXT NOT NULL,
            progress TEXT NOT NULL,
            output_path TEXT,
            media_zip TEXT,
            error_msg TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    
    # Check if started_at, finished_at, and duration columns exist, and migrate if missing
    cursor.execute("PRAGMA table_info(crawler_jobs)")
    columns = [row[1] for row in cursor.fetchall()]
    if "started_at" not in columns:
        cursor.execute("ALTER TABLE crawler_jobs ADD COLUMN started_at TEXT")
    if "finished_at" not in columns:
        cursor.execute("ALTER TABLE crawler_jobs ADD COLUMN finished_at TEXT")
    if "duration" not in columns:
        cursor.execute("ALTER TABLE crawler_jobs ADD COLUMN duration INTEGER")
    if "crawl_mode" not in columns:
        cursor.execute("ALTER TABLE crawler_jobs ADD COLUMN crawl_mode TEXT DEFAULT 'catalog'")
    if "images_total" not in columns:
        cursor.execute("ALTER TABLE crawler_jobs ADD COLUMN images_total INTEGER DEFAULT 0")
    if "images_completed" not in columns:
        cursor.execute("ALTER TABLE crawler_jobs ADD COLUMN images_completed INTEGER DEFAULT 0")
    if "media_status" not in columns:
        cursor.execute("ALTER TABLE crawler_jobs ADD COLUMN media_status TEXT DEFAULT 'none'")
        
    conn.commit()
    conn.close()

def create_job(job_id: str, target: str, params: Dict[str, Any], crawl_mode: str = "catalog") -> Dict[str, Any]:
    """Register a new crawl job in the database."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    now = datetime.now().isoformat()
    # Default initial progress counters
    initial_progress = {
        "processed_categories": 0,
        "total_categories": 0,
        "products_found": 0,
        "current_action": "Initializing campaign..."
    }
    
    cursor.execute(
        """
        INSERT INTO crawler_jobs 
        (job_id, status, pid, target, params, progress, created_at, updated_at, started_at, finished_at, duration, crawl_mode, images_total, images_completed, media_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            job_id,
            "pending",
            None,
            target,
            json.dumps(params),
            json.dumps(initial_progress),
            now,
            now,
            None,
            None,
            None,
            crawl_mode,
            0,
            0,
            "none"
        )
    )
    
    # Pre-create job logging and output workspace directory
    os.makedirs(os.path.join(JOBS_DIR, job_id), exist_ok=True)
    
    conn.commit()
    conn.close()
    
    return {
        "job_id": job_id,
        "status": "pending",
        "target": target,
        "params": params,
        "progress": initial_progress,
        "created_at": now,
        "updated_at": now
    }

def update_job_status(job_id: str, status: str, error_msg: Optional[str] = None):
    """Update only the status field and log any execution error if provided."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    if error_msg:
        cursor.execute(
            "UPDATE crawler_jobs SET status = ?, error_msg = ?, updated_at = ? WHERE job_id = ?",
            (status, error_msg, now, job_id)
        )
    else:
        cursor.execute(
            "UPDATE crawler_jobs SET status = ?, updated_at = ? WHERE job_id = ?",
            (status, now, job_id)
        )
    conn.commit()
    conn.close()

def update_job_pid(job_id: str, pid: int):
    """Register the OS process ID, started timestamp and status for a spawned subprocess."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "UPDATE crawler_jobs SET pid = ?, status = 'running', started_at = ?, updated_at = ? WHERE job_id = ?",
        (pid, now, now, job_id)
    )
    conn.commit()
    conn.close()

def update_job_progress(job_id: str, progress_metrics: Dict[str, Any]):
    """Update active progress counters and metrics dynamically."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    # Load current progress and merge to preserve unmodified counters
    cursor.execute("SELECT progress FROM crawler_jobs WHERE job_id = ?", (job_id,))
    row = cursor.fetchone()
    if row:
        current = json.loads(row[0])
        current.update(progress_metrics)
        cursor.execute(
            "UPDATE crawler_jobs SET progress = ?, updated_at = ? WHERE job_id = ?",
            (json.dumps(current), now, job_id)
        )
    conn.commit()
    conn.close()

def append_job_log(job_id: str, log_line: str):
    """Append a stdout/stderr log line to a separate local file for the campaign."""
    job_workspace = os.path.join(JOBS_DIR, job_id)
    os.makedirs(job_workspace, exist_ok=True)
    log_path = os.path.join(job_workspace, "logs.txt")
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {log_line}\n")

def get_job_logs(job_id: str) -> List[str]:
    """Retrieve all logged telemetry outputs for a given campaign."""
    log_path = os.path.join(JOBS_DIR, job_id, "logs.txt")
    if not os.path.exists(log_path):
        return []
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            return f.readlines()
    except Exception:
        return []

def finalize_job(
    job_id: str, 
    status: str, 
    output_path: Optional[str] = None, 
    media_zip: Optional[str] = None, 
    error_msg: Optional[str] = None
):
    """Complete a campaign execution, recording output file locations, finish bounds, and total runtime duration."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    # Calculate execution duration
    cursor.execute("SELECT started_at, created_at FROM crawler_jobs WHERE job_id = ?", (job_id,))
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
        UPDATE crawler_jobs 
        SET status = ?, output_path = ?, media_zip = ?, error_msg = ?, finished_at = ?, duration = ?, updated_at = ?
        WHERE job_id = ?
        """,
        (status, output_path, media_zip, error_msg, now, duration, now, job_id)
    )
    conn.commit()
    conn.close()

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve details of a single crawl campaign job."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT job_id, status, pid, target, params, progress, output_path, media_zip, error_msg, created_at, updated_at, started_at, finished_at, duration, crawl_mode, images_total, images_completed, media_status FROM crawler_jobs WHERE job_id = ?",
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
        "target": row[3],
        "params": json.loads(row[4]),
        "progress": json.loads(row[5]),
        "output_path": row[6],
        "media_zip": row[7],
        "error_msg": row[8],
        "created_at": row[9],
        "updated_at": row[10],
        "started_at": row[11],
        "finished_at": row[12],
        "duration": row[13],
        "crawl_mode": row[14],
        "images_total": row[15],
        "images_completed": row[16],
        "media_status": row[17]
    }

def get_jobs(limit: int = 20, offset: int = 0, status: Optional[str] = None) -> Dict[str, Any]:
    """Retrieve a paged list of all historical and active crawl campaigns."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    query = "SELECT job_id, status, pid, target, params, progress, output_path, media_zip, error_msg, created_at, updated_at, started_at, finished_at, duration, crawl_mode, images_total, images_completed, media_status FROM crawler_jobs"
    count_query = "SELECT COUNT(*) FROM crawler_jobs"
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
            "target": row[3],
            "params": json.loads(row[4]),
            "progress": json.loads(row[5]),
            "output_path": row[6],
            "media_zip": row[7],
            "error_msg": row[8],
            "created_at": row[9],
            "updated_at": row[10],
            "started_at": row[11],
            "finished_at": row[12],
            "duration": row[13],
            "crawl_mode": row[14],
            "images_total": row[15],
            "images_completed": row[16],
            "media_status": row[17]
        })
        
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "jobs": jobs
    }

def start_media_phase(job_id: str, images_total: int):
    """Mark media extraction as started for a campaign."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "UPDATE crawler_jobs SET media_status = 'running', images_total = ?, images_completed = 0, updated_at = ? WHERE job_id = ?",
        (images_total, now, job_id)
    )
    conn.commit()
    conn.close()

def update_media_progress(job_id: str, images_completed: int):
    """Update count of successfully downloaded/processed media assets."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "UPDATE crawler_jobs SET images_completed = ?, updated_at = ? WHERE job_id = ?",
        (images_completed, now, job_id)
    )
    conn.commit()
    conn.close()

def finalize_media_phase(job_id: str, status: str, media_zip: Optional[str] = None):
    """Finalize the media extraction phase with its completion status and ZIP path."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "UPDATE crawler_jobs SET media_status = ?, media_zip = ?, updated_at = ? WHERE job_id = ?",
        (status, media_zip, now, job_id)
    )
    conn.commit()
    conn.close()
