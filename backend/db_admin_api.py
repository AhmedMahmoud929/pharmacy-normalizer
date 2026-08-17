"""Database administration API — clean database tables and import/export backups."""

from __future__ import annotations

import os
import shutil
import sqlite3
import tempfile
import time
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from auth_api import get_current_user
from auth_utils import create_purpose_token, decode_purpose_token, verify_password
from db.backup_utils import (
    LARGE_OPTIONAL_TABLES,
    PROTECTED_TABLES,
    default_export_tables,
    list_all_tables,
    normalize_export_tables,
    resolve_backup_file,
)
from db.config import DEFAULT_DB_PATH
from db.connection import get_connection

router = APIRouter(prefix="/api/db-admin", tags=["db-admin"])

_reload_catalog_index = None


def register_db_admin_deps(reload_catalog_index_fn) -> None:
    global _reload_catalog_index
    _reload_catalog_index = reload_catalog_index_fn


class CleanRequest(BaseModel):
    password: str
    tables: List[str]
    clean_all: bool


class ExportRequest(BaseModel):
    password: str
    tables: List[str] = Field(default_factory=list)


def _table_size_bytes(conn: sqlite3.Connection, table: str) -> int:
    try:
        row = conn.execute("SELECT SUM(pgsize) FROM dbstat WHERE name = ?", (table,)).fetchone()
        if row and row[0]:
            return int(row[0])
    except sqlite3.Error:
        pass
    return 0


def _table_category(name: str) -> str:
    if name in PROTECTED_TABLES:
        return "system"
    if name.endswith("_job_results"):
        return "job_results"
    if name.endswith("_jobs") or name == "catalog_pipeline_jobs":
        return "jobs"
    if name.startswith("catalog_"):
        return "catalog"
    if name in {"brands", "tokens", "stop_words"}:
        return "normalizer"
    if name == "source_profiles":
        return "discovery"
    return "other"


@router.get("/tables")
async def get_tables(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Retrieve all database tables with row counts and on-disk size estimates."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can manage the database.")

    tables_info = []
    with get_connection() as conn:
        cursor = conn.cursor()
        tables = list_all_tables(conn)

        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) as count FROM {table};")
                count = cursor.fetchone()["count"]
                size_bytes = _table_size_bytes(conn, table)
                tables_info.append({
                    "name": table,
                    "rows": count,
                    "size_bytes": size_bytes,
                    "category": _table_category(table),
                    "protected": table in PROTECTED_TABLES,
                    "large_optional": table in LARGE_OPTIONAL_TABLES,
                    "default_export": table not in LARGE_OPTIONAL_TABLES,
                })
            except Exception as e:
                tables_info.append({
                    "name": table,
                    "rows": 0,
                    "size_bytes": 0,
                    "category": _table_category(table),
                    "protected": table in PROTECTED_TABLES,
                    "large_optional": table in LARGE_OPTIONAL_TABLES,
                    "default_export": table not in LARGE_OPTIONAL_TABLES,
                    "error": str(e),
                })

    return {"tables": tables_info}


@router.post("/clean")
async def clean_database(
    body: CleanRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Empty data in specified tables or clean the whole database with system exceptions (Admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can manage the database.")

    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    tables_to_clean = []
    with get_connection() as conn:
        cursor = conn.cursor()
        all_tables = list_all_tables(conn)

        if body.clean_all:
            tables_to_clean = [t for t in all_tables if t not in PROTECTED_TABLES]
        else:
            for table in body.tables:
                if table not in all_tables:
                    raise HTTPException(status_code=400, detail=f"Table '{table}' does not exist.")
                if table in PROTECTED_TABLES:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Table '{table}' is protected and cannot be deleted for system stability."
                    )
            tables_to_clean = body.tables

        cursor.execute("PRAGMA foreign_keys = OFF;")
        for table in tables_to_clean:
            cursor.execute(f"DELETE FROM {table};")
        cursor.execute("PRAGMA foreign_keys = ON;")

    if tables_to_clean:
        vacuum_conn = sqlite3.connect(DEFAULT_DB_PATH)
        try:
            vacuum_conn.isolation_level = None
            vacuum_conn.execute("VACUUM")
        finally:
            vacuum_conn.close()

    if _reload_catalog_index:
        _reload_catalog_index()

    return {
        "status": "success",
        "cleaned_tables": tables_to_clean,
        "message": f"Successfully cleaned data from {len(tables_to_clean)} tables."
    }


@router.post("/backup/export")
async def export_db(
    body: ExportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Authorize a database backup download with optional table selection (Admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can manage the database.")

    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    if not os.path.exists(DEFAULT_DB_PATH):
        raise HTTPException(status_code=404, detail="Database file not found.")

    with get_connection() as conn:
        all_tables = list_all_tables(conn)

    if body.tables:
        export_tables = normalize_export_tables(body.tables, set(all_tables))
    else:
        export_tables = default_export_tables(all_tables)

    if not export_tables:
        raise HTTPException(status_code=400, detail="No tables selected for export.")

    download_token = create_purpose_token(
        user_id=str(current_user["id"]),
        purpose="db_backup_download",
        data={"tables": export_tables},
    )
    filename = f"pharmatcher_backup_{int(time.time())}.db"

    return {
        "download_url": f"/api/db-admin/backup/download?token={download_token}",
        "filename": filename,
        "tables": export_tables,
        "table_count": len(export_tables),
    }


@router.get("/backup/download")
async def download_db_backup(
    background_tasks: BackgroundTasks,
    token: str = Query(...),
):
    """Stream database backup file using a short-lived download token."""
    try:
        payload = decode_purpose_token(token, purpose="db_backup_download")
    except ValueError:
        raise HTTPException(status_code=403, detail="Invalid or expired download token.")

    if not os.path.exists(DEFAULT_DB_PATH):
        raise HTTPException(status_code=404, detail="Database file not found.")

    tables = (payload.get("data") or {}).get("tables") or []
    try:
        backup_path, is_temp = resolve_backup_file(tables)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if is_temp:
        background_tasks.add_task(os.remove, backup_path)

    return FileResponse(
        path=backup_path,
        filename=f"pharmatcher_backup_{int(time.time())}.db",
        media_type="application/x-sqlite3",
    )


@router.post("/backup/import")
async def import_db(
    file: UploadFile = File(...),
    password: str = Form(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Restore database from a uploaded SQLite database backup file (Admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can manage the database.")

    if not verify_password(password, current_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    temp_fd, temp_path = tempfile.mkstemp(suffix=".db")
    try:
        with os.fdopen(temp_fd, "wb") as tmp:
            shutil.copyfileobj(file.file, tmp)

        try:
            temp_conn = sqlite3.connect(temp_path)
            temp_cursor = temp_conn.cursor()
            temp_cursor.execute("PRAGMA schema_version;")
            temp_cursor.fetchone()

            temp_cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [row[0] for row in temp_cursor.fetchall()]
            required = ["users", "schema_meta"]
            for req in required:
                if req not in tables:
                    raise ValueError(f"Missing required table: '{req}'")
            temp_conn.close()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid database file format: {str(e)}")

        src_conn = sqlite3.connect(temp_path)
        dest_conn = sqlite3.connect(DEFAULT_DB_PATH)
        try:
            with dest_conn:
                src_conn.backup(dest_conn)
        finally:
            src_conn.close()
            dest_conn.close()

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    if _reload_catalog_index:
        _reload_catalog_index()

    tables_info = []
    total_rows = 0
    with get_connection() as conn:
        cursor = conn.cursor()
        table_names = list_all_tables(conn)
        for table in table_names:
            try:
                cursor.execute(f"SELECT COUNT(*) as count FROM {table};")
                count = int(cursor.fetchone()["count"])
            except Exception:
                count = 0
            tables_info.append({"name": table, "rows": count})
            total_rows += count

    return {
        "status": "success",
        "message": "Database backup successfully restored and reloaded.",
        "filename": file.filename or "backup.db",
        "tables_count": len(tables_info),
        "total_rows": total_rows,
        "tables": tables_info,
    }
