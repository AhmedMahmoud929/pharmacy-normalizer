"""Authentication and user management API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from auth_utils import create_access_token, decode_access_token, verify_password
from db import users_repo

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)
    name: str = ""
    role: str = Field(default="user", pattern="^(admin|user)$")


class UpdateUserRequest(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=4)
    name: Optional[str] = None
    role: Optional[str] = Field(default=None, pattern="^(admin|user)$")
    is_active: Optional[bool] = None


def _public_user(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row.get("name") or "",
        "role": row["role"],
        "is_active": bool(row.get("is_active", 1)),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _extract_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    cookie_token = request.cookies.get("pharmatch_token")
    if cookie_token:
        return cookie_token
    return request.query_params.get("token")


def get_current_user(request: Request) -> Dict[str, Any]:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_access_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = users_repo.get_user_by_id(str(payload.get("sub") or ""))
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    user = users_repo.get_user_by_email(body.email)
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(
        user_id=user["id"],
        email=user["email"],
        role=user["role"],
        name=user.get("name") or "",
    )
    return LoginResponse(access_token=token, user=_public_user(user))


@router.get("/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    return _public_user(user)


@router.get("/users")
async def list_users(_admin: Dict[str, Any] = Depends(require_admin)):
    return {"users": users_repo.list_users()}


@router.post("/users")
async def create_user(body: CreateUserRequest, _admin: Dict[str, Any] = Depends(require_admin)):
    if users_repo.get_user_by_email(body.email):
        raise HTTPException(status_code=409, detail="Email already exists")
    user = users_repo.create_user(
        email=body.email,
        password=body.password,
        name=body.name,
        role=body.role,
    )
    return _public_user(user)


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UpdateUserRequest,
    admin: Dict[str, Any] = Depends(require_admin),
):
    existing = users_repo.get_user_by_id(user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    if body.email and body.email.lower() != existing["email"].lower():
        clash = users_repo.get_user_by_email(body.email)
        if clash and clash["id"] != user_id:
            raise HTTPException(status_code=409, detail="Email already exists")

    if body.is_active is False and user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    if body.role == "user" and existing["role"] == "admin" and user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin role")

    updated = users_repo.update_user(
        user_id,
        email=body.email,
        name=body.name,
        role=body.role,
        is_active=body.is_active,
        password=body.password,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return _public_user(updated)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: Dict[str, Any] = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if not users_repo.delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "deleted", "user_id": user_id}
