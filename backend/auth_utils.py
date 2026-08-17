"""Authentication helpers — password hashing and signed access tokens."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Dict, Optional

JWT_SECRET = os.environ.get("JWT_SECRET", "pharmatch-dev-secret-change-in-production")
TOKEN_TTL_HOURS = int(os.environ.get("JWT_TTL_HOURS", "12"))


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    )
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, digest = stored_hash.split("$", 1)
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    )
    return hmac.compare_digest(check.hex(), digest)


def create_access_token(
    *,
    user_id: str,
    email: str,
    role: str,
    name: Optional[str] = None,
    permissions: Optional[list[str]] = None,
) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "name": name or "",
        "permissions": permissions or [],
        "exp": int(time.time()) + TOKEN_TTL_HOURS * 3600,
    }
    data = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    sig = hmac.new(JWT_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()
    return f"{data}.{sig}"


def create_purpose_token(*, user_id: str, purpose: str, ttl_seconds: int = 120) -> str:
    payload = {
        "sub": user_id,
        "purpose": purpose,
        "exp": int(time.time()) + ttl_seconds,
    }
    data = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    sig = hmac.new(JWT_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()
    return f"{data}.{sig}"


def decode_purpose_token(token: str, *, purpose: str) -> Dict[str, Any]:
    try:
        data, sig = token.rsplit(".", 1)
    except ValueError as exc:
        raise ValueError("Invalid token format") from exc

    expected = hmac.new(JWT_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        raise ValueError("Invalid token signature")

    padded = data + "=" * (-len(data) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded.encode()))
    if payload.get("purpose") != purpose:
        raise ValueError("Invalid token purpose")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("Token expired")
    return payload


def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        data, sig = token.rsplit(".", 1)
    except ValueError as exc:
        raise ValueError("Invalid token format") from exc

    expected = hmac.new(JWT_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        raise ValueError("Invalid token signature")

    padded = data + "=" * (-len(data) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded.encode()))
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("Token expired")
    return payload
