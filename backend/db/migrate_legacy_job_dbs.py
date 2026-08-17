"""One-time migration of per-feature job SQLite files into pharmatcher.db."""

from __future__ import annotations

import os
import sqlite3

from db.config import DEFAULT_DB_PATH

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEGACY_DB_DIR = os.path.join(backend_root, "data", "extracted")

LEGACY_JOB_DATABASES: dict[str, list[str]] = {
    "matcher_jobs.db": ["matcher_jobs", "matcher_job_results"],
    "discovery_jobs.db": ["discovery_jobs", "discovery_job_results"],
    "enrichment_jobs.db": ["enrichment_jobs", "enrichment_job_results"],
}


def _is_migrated(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT value FROM schema_meta WHERE key = ?",
        ("legacy_job_dbs_migrated",),
    ).fetchone()
    return bool(row and row[0] == "1")


def _mark_migrated(conn: sqlite3.Connection) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)",
        ("legacy_job_dbs_migrated", "1"),
    )


def _table_exists(conn: sqlite3.Connection, schema: str, table: str) -> bool:
    row = conn.execute(
        f"SELECT name FROM {schema}.sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    return bool(row)


def _copy_table(dest: sqlite3.Connection, table: str) -> int:
    if not _table_exists(dest, "main", table):
        return 0
    if not _table_exists(dest, "legacy_src", table):
        return 0

    src_count = dest.execute(f'SELECT COUNT(*) FROM legacy_src."{table}"').fetchone()[0]
    if src_count == 0:
        return 0

    dest_count = dest.execute(f'SELECT COUNT(*) FROM main."{table}"').fetchone()[0]
    if dest_count > 0:
        return 0

    create_row = dest.execute(
        "SELECT sql FROM legacy_src.sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    if create_row and create_row[0]:
        dest.execute(create_row[0].replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS", 1))

    dest.execute(f'INSERT INTO main."{table}" SELECT * FROM legacy_src."{table}"')
    return int(src_count)


def _migrate_one_legacy_db(legacy_path: str, tables: list[str]) -> bool:
    migrated_any = False
    dest = sqlite3.connect(DEFAULT_DB_PATH, timeout=120)
    try:
        dest.execute("PRAGMA foreign_keys=OFF")
        dest.execute("ATTACH DATABASE ? AS legacy_src", (legacy_path,))
        try:
            for table in tables:
                try:
                    copied = _copy_table(dest, table)
                    if copied:
                        migrated_any = True
                except sqlite3.Error:
                    dest.rollback()
                    raise
            dest.commit()
        finally:
            dest.execute("DETACH DATABASE legacy_src")
    finally:
        dest.close()
    return migrated_any


def migrate_legacy_job_databases() -> None:
    if not os.path.exists(DEFAULT_DB_PATH):
        return

    probe = sqlite3.connect(DEFAULT_DB_PATH, timeout=120)
    try:
        if _is_migrated(probe):
            return
    finally:
        probe.close()

    migrated_any = False
    for legacy_name, tables in LEGACY_JOB_DATABASES.items():
        legacy_path = os.path.join(LEGACY_DB_DIR, legacy_name)
        if not os.path.exists(legacy_path):
            continue

        if _migrate_one_legacy_db(legacy_path, tables):
            migrated_any = True

        archived = f"{legacy_path}.migrated"
        if not os.path.exists(archived):
            os.replace(legacy_path, archived)

    finalize = sqlite3.connect(DEFAULT_DB_PATH, timeout=120)
    try:
        if migrated_any or all(
            not os.path.exists(os.path.join(LEGACY_DB_DIR, name))
            for name in LEGACY_JOB_DATABASES
        ):
            _mark_migrated(finalize)
        finalize.commit()
    finally:
        finalize.close()
