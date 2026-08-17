"""Helpers for partial database backup exports."""

from __future__ import annotations

import os
import shutil
import sqlite3
import tempfile
from typing import Iterable, List, Set

from db.config import DEFAULT_DB_PATH

PROTECTED_TABLES = {"users", "schema_meta"}

# Large blob tables excluded from default export selection
LARGE_OPTIONAL_TABLES = {
    "matcher_job_results",
    "discovery_job_results",
    "enrichment_job_results",
}


def list_all_tables(conn: sqlite3.Connection) -> List[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    return [row[0] for row in rows]


def default_export_tables(all_tables: Iterable[str]) -> List[str]:
    return [t for t in all_tables if t not in LARGE_OPTIONAL_TABLES]


def normalize_export_tables(requested: Iterable[str], all_tables: Set[str]) -> List[str]:
    selected = set(requested) & all_tables
    selected |= PROTECTED_TABLES & all_tables
    return sorted(selected)


def is_full_export(selected: List[str], all_tables: List[str]) -> bool:
    return set(selected) == set(all_tables)


def build_partial_backup(tables: List[str]) -> str:
    fd, temp_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    dest = sqlite3.connect(temp_path)
    src = sqlite3.connect(DEFAULT_DB_PATH)
    try:
        dest.execute("PRAGMA foreign_keys=OFF")
        src_path = os.path.abspath(DEFAULT_DB_PATH).replace("'", "''")
        dest.execute(f"ATTACH DATABASE '{src_path}' AS src_db")

        for table in tables:
            create_row = src.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
                (table,),
            ).fetchone()
            if not create_row or not create_row[0]:
                continue

            dest.execute(create_row[0])
            dest.execute(f'INSERT INTO main."{table}" SELECT * FROM src_db."{table}"')

            for idx_row in src.execute(
                "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL",
                (table,),
            ).fetchall():
                try:
                    dest.execute(idx_row[0])
                except sqlite3.OperationalError:
                    pass

        dest.execute("DETACH DATABASE src_db")
        dest.commit()
    finally:
        src.close()
        dest.close()

    return temp_path


def resolve_backup_file(tables: List[str]) -> tuple[str, bool]:
    """Return (path, is_temp) for a backup download."""
    src = sqlite3.connect(DEFAULT_DB_PATH)
    try:
        all_tables = list_all_tables(src)
    finally:
        src.close()

    selected = normalize_export_tables(tables, set(all_tables))
    if not selected:
        raise ValueError("No valid tables selected for export.")

    if is_full_export(selected, all_tables):
        return DEFAULT_DB_PATH, False

    return build_partial_backup(selected), True
