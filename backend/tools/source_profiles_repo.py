"""Repository for user-configured discovery source profiles."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from db.connection import get_connection
from db.schema import init_schema


def _now_iso() -> str:
    return datetime.now().isoformat()


def _row_to_dict(row: Dict[str, Any]) -> Dict[str, Any]:
    data = dict(row)
    for key in ("search_config_json", "extract_config_json", "raw_json"):
        raw = data.get(key)
        if raw and isinstance(raw, str):
            try:
                data[key.replace("_json", "")] = json.loads(raw)
            except json.JSONDecodeError:
                data[key.replace("_json", "")] = {}
        else:
            data[key.replace("_json", "")] = {}
    data["enabled"] = bool(data.get("enabled", 1))
    return data


def list_profiles(*, enabled_only: bool = False) -> List[Dict[str, Any]]:
    init_schema()
    with get_connection() as conn:
        if enabled_only:
            cur = conn.execute(
                """
                SELECT * FROM source_profiles
                WHERE enabled = 1
                ORDER BY priority ASC, domain ASC
                """
            )
        else:
            cur = conn.execute(
                "SELECT * FROM source_profiles ORDER BY priority ASC, domain ASC"
            )
        return [_row_to_dict(dict(r)) for r in cur.fetchall()]


def get_profile(domain: str) -> Optional[Dict[str, Any]]:
    init_schema()
    with get_connection() as conn:
        cur = conn.execute(
            "SELECT * FROM source_profiles WHERE domain = ?",
            (domain,),
        )
        row = cur.fetchone()
        return _row_to_dict(dict(row)) if row else None


def upsert_profile(profile: Dict[str, Any]) -> Dict[str, Any]:
    init_schema()
    domain = profile["domain"]
    now = _now_iso()
    search_json = json.dumps(profile.get("search_config") or {}, ensure_ascii=False)
    extract_json = json.dumps(profile.get("extract_config") or {}, ensure_ascii=False)
    raw_json = json.dumps(profile.get("raw") or {}, ensure_ascii=False)

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT domain FROM source_profiles WHERE domain = ?",
            (domain,),
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE source_profiles SET
                    display_name = ?, platform = ?, enabled = ?, priority = ?,
                    search_config_json = ?, extract_config_json = ?,
                    sample_url = ?, created_by = COALESCE(created_by, ?),
                    last_tested_at = ?, last_test_status = ?,
                    raw_json = ?, updated_at = ?
                WHERE domain = ?
                """,
                (
                    profile.get("display_name") or domain,
                    profile.get("platform") or "custom",
                    1 if profile.get("enabled", True) else 0,
                    int(profile.get("priority", 100)),
                    search_json,
                    extract_json,
                    profile.get("sample_url"),
                    profile.get("created_by"),
                    profile.get("last_tested_at"),
                    profile.get("last_test_status"),
                    raw_json,
                    now,
                    domain,
                ),
            )
        else:
            conn.execute(
                """
                INSERT INTO source_profiles (
                    domain, display_name, platform, enabled, priority,
                    search_config_json, extract_config_json, sample_url,
                    created_by, last_tested_at, last_test_status, raw_json,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    domain,
                    profile.get("display_name") or domain,
                    profile.get("platform") or "custom",
                    1 if profile.get("enabled", True) else 0,
                    int(profile.get("priority", 100)),
                    search_json,
                    extract_json,
                    profile.get("sample_url"),
                    profile.get("created_by"),
                    profile.get("last_tested_at"),
                    profile.get("last_test_status"),
                    raw_json,
                    now,
                    now,
                ),
            )
    return get_profile(domain) or profile


def delete_profile(domain: str) -> bool:
    if domain == "chefaa.com":
        return False
    init_schema()
    with get_connection() as conn:
        cur = conn.execute(
            "DELETE FROM source_profiles WHERE domain = ?",
            (domain,),
        )
        return cur.rowcount > 0


def update_test_status(domain: str, status: str) -> None:
    init_schema()
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE source_profiles
            SET last_tested_at = ?, last_test_status = ?, updated_at = ?
            WHERE domain = ?
            """,
            (_now_iso(), status, _now_iso(), domain),
        )
