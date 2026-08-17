"""Resource permissions — one permission per dashboard module."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Sequence, Union

# One permission string per resource (no :read / :write splits).
ALL_PERMISSIONS: List[str] = [
    "matcher",
    "enrichment",
    "catalog",
    "crawler",
    "browse",
    "gallery",
    "search",
    "normalize",
    "discovery",
    "users",
]

PERMISSION_LABELS: Dict[str, str] = {
    "matcher": "Match Sheet",
    "enrichment": "Barcode Enrichment",
    "catalog": "Catalog Seeder",
    "crawler": "Campaign Crawler",
    "browse": "Browse DB",
    "gallery": "Media Gallery",
    "search": "Global Search",
    "normalize": "Normalize",
    "discovery": "Product Discovery",
    "users": "User Management",
}


def parse_permissions(raw: Any) -> List[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            items = parsed if isinstance(parsed, list) else []
        except (json.JSONDecodeError, TypeError):
            items = []
    else:
        items = []
    return [p for p in items if p in ALL_PERMISSIONS]


def effective_permissions(user: Dict[str, Any]) -> List[str]:
    if user.get("role") == "admin":
        return list(ALL_PERMISSIONS)
    return parse_permissions(user.get("permissions"))


def has_permission(user: Dict[str, Any], permission: str) -> bool:
    return permission in effective_permissions(user)


PermissionRule = Union[str, Sequence[str], None]


def permission_for_path(path: str, method: str) -> PermissionRule:
    """Return required permission(s) for an API path, or None if auth-only."""
    p = path.rstrip("/") or "/"
    m = method.upper()

    if p.startswith("/api/auth/me"):
        return None
    if p.startswith("/api/auth/permissions"):
        return None
    if p.startswith("/api/auth/users") or p.startswith("/api/db-admin"):
        return "users"
    if p.startswith("/media/"):
        return None

    if p.startswith("/api/matcher") or p.startswith("/match/sheet") or p.startswith("/match/save"):
        return "matcher"
    if p == "/match" and m == "GET":
        return ("search", "matcher")
    if p.startswith("/match"):
        return "matcher"

    if p.startswith("/api/enrichment"):
        return "enrichment"
    if p.startswith("/api/catalog"):
        return "catalog"
    if p.startswith("/api/crawler"):
        return "crawler"
    if p.startswith("/api/gallery"):
        return "gallery"
    if p.startswith("/api/discovery") or p.startswith("/api/sources"):
        return "discovery"
    if p.startswith("/normalize"):
        return "normalize"
    if p.startswith("/db/"):
        return "browse"

    return None


def can_access_path(user: Dict[str, Any], path: str, method: str) -> bool:
    required = permission_for_path(path, method)
    if required is None:
        return True
    if isinstance(required, str):
        return has_permission(user, required)
    return any(has_permission(user, perm) for perm in required)


def permission_for_dashboard_path(path: str) -> Optional[str]:
    """Map frontend dashboard route to a single permission."""
    if path.startswith("/dashboard/admin/users"):
        return "users"
    if path.startswith("/dashboard/matcher"):
        return "matcher"
    if path.startswith("/dashboard/enrichment"):
        return "enrichment"
    if path.startswith("/dashboard/catalog"):
        return "catalog"
    if path.startswith("/dashboard/crawler"):
        return "crawler"
    if path.startswith("/dashboard/browse"):
        return "browse"
    if path.startswith("/dashboard/gallery"):
        return "gallery"
    if path.startswith("/dashboard/search"):
        return "search"
    if path.startswith("/dashboard/normalize"):
        return "normalize"
    if path.startswith("/dashboard/discovery"):
        return "discovery"
    return None
