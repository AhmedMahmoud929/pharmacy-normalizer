"""User repository — authentication and admin user management."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from auth_utils import hash_password
from db.connection import get_connection
from db.schema import init_schema


def _now_iso() -> str:
    return datetime.now().isoformat()


def _row_to_user(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row.get("name") or "",
        "role": row["role"],
        "is_active": bool(row.get("is_active", 1)),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def ensure_users_schema() -> None:
    init_schema()
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                name TEXT,
                role TEXT NOT NULL DEFAULT 'user',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
            """
        )


def seed_admin_if_missing(*, email: str, password: str, name: str = "Admin") -> None:
    ensure_users_schema()
    existing = get_user_by_email(email)
    if existing:
        return
    create_user(email=email, password=password, name=name, role="admin")


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    ensure_users_schema()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ? COLLATE NOCASE",
            (email.strip(),),
        ).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    ensure_users_schema()
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


def list_users() -> List[Dict[str, Any]]:
    ensure_users_schema()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, email, name, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC"
        ).fetchall()
        return [_row_to_user(dict(r)) for r in rows]


def create_user(
    *,
    email: str,
    password: str,
    name: str = "",
    role: str = "user",
    is_active: bool = True,
) -> Dict[str, Any]:
    ensure_users_schema()
    user_id = str(uuid.uuid4())
    now = _now_iso()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                email.strip().lower(),
                hash_password(password),
                name.strip(),
                role,
                1 if is_active else 0,
                now,
                now,
            ),
        )
    user = get_user_by_id(user_id)
    assert user is not None
    return _row_to_user(user)


def update_user(
    user_id: str,
    *,
    email: Optional[str] = None,
    name: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    password: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    ensure_users_schema()
    row = get_user_by_id(user_id)
    if not row:
        return None

    new_email = email.strip().lower() if email is not None else row["email"]
    new_name = name.strip() if name is not None else (row.get("name") or "")
    new_role = role if role is not None else row["role"]
    new_active = (1 if is_active else 0) if is_active is not None else int(row.get("is_active", 1))
    password_hash = hash_password(password) if password else row["password_hash"]

    with get_connection() as conn:
        conn.execute(
            """
            UPDATE users
            SET email = ?, name = ?, role = ?, is_active = ?, password_hash = ?, updated_at = ?
            WHERE id = ?
            """,
            (new_email, new_name, new_role, new_active, password_hash, _now_iso(), user_id),
        )

    updated = get_user_by_id(user_id)
    return _row_to_user(updated) if updated else None


def delete_user(user_id: str) -> bool:
    ensure_users_schema()
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        return cur.rowcount > 0
