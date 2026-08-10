import os
import sqlite3
from contextlib import contextmanager
from typing import Iterator

from db.config import DATA_DIR, DEFAULT_DB_PATH


def ensure_data_dir() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)


@contextmanager
def get_connection(db_path: str = DEFAULT_DB_PATH) -> Iterator[sqlite3.Connection]:
    ensure_data_dir()
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA synchronous=NORMAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
