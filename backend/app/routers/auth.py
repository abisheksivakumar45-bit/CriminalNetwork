"""Authentication endpoints: login, refresh, logout, session, user admin."""
import threading
import time
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import config
from app.services import auth_service
from app.dependencies import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    get_current_user,
    require_roles,
    ROLE_ADMIN,
)
from app.models.schemas import UserCreate, UserResponse, AuthSuccessResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

GENERIC_LOGIN_ERROR = "Invalid username or password."


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=256)


# ─────────────────────────── Basic brute-force protection ────────────────
# Keyed by (username, client IP). Client IP is the address seen by the
# backend (nginx container in production) so the username part is the
# effective lockout scope for this prototype.
_attempts: Dict[str, list] = {}
_attempts_lock = threading.Lock()


def _attempt_key(username: str, client_ip: str) -> str:
    return f"{username.lower()}@{client_ip or 'unknown'}"


def _is_locked_out(key: str) -> bool:
    now = time.time()
    with _attempts_lock:
        stamps = _attempts.get(key, [])
        _attempts[key] = [s for s in stamps if now - s < config.AUTH_LOGIN_LOCKOUT_SECONDS]
        return len(_attempts.get(key, [])) >= config.AUTH_LOGIN_MAX_ATTEMPTS


def _record_failure(key: str):
    now = time.time()
    with _attempts_lock:
        stamps = _attempts.get(key, [])
        stamps = [s for s in stamps if now - s < config.AUTH_LOGIN_LOCKOUT_SECONDS]
        stamps.append(now)
        _attempts[key] = stamps


def _clear_attempts(key: str):
    with _attempts_lock:
        _attempts.pop(key, None)


# ─────────────────────────── Cookie helpers ──────────────────────────────
def _set_auth_cookies(response: Response, access: str, refresh: str):
    common = {
        "httponly": True,
        "samesite": "lax",
        "secure": config.AUTH_COOKIE_SECURE,
        "path": "/api",
    }
    response.set_cookie(
        key=ACCESS_COOKIE, value=access,
        max_age=config.AUTH_ACCESS_TOKEN_EXPIRE_MINUTES * 60, **common,
    )
    response.set_cookie(
        key=REFRESH_COOKIE, value=refresh,
        max_age=config.AUTH_REFRESH_TOKEN_EXPIRE_DAYS * 86400, **common,
    )


def _clear_auth_cookies(response: Response):
    common = {"httponly": True, "samesite": "lax", "secure": config.AUTH_COOKIE_SECURE, "path": "/api"}
    response.delete_cookie(key=ACCESS_COOKIE, **common)
    response.delete_cookie(key=REFRESH_COOKIE, **common)


def _public_user(user: dict) -> dict:
    return {
        "username": user.get("username", ""),
        "display_name": user.get("display_name", ""),
        "email": user.get("email", ""),
        "role": user.get("role", ""),
    }


def _load_for_session(username: str) -> dict:
    user = auth_service.get_user(username)
    if not user or not user.get("active"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return _public_user(user)


# ─────────────────────────── Endpoints ───────────────────────────────────
@router.post("/login", response_model=AuthSuccessResponse)
def login(data: LoginRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else ""
    key = _attempt_key(data.username, client_ip)

    if _is_locked_out(key):
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again later.")

    user = auth_service.get_user(data.username)
    if not user or not user.get("active"):
        _record_failure(key)
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)

    if not verify_credential(user, data.password):
        # Demo accounts self-heal: if the stored hash drifted from the current
        # .env demo password, re-sync it (see auth_service.reconcile_demo_password).
        # Non-demo accounts are unaffected.
        if not auth_service.reconcile_demo_password(user["username"]):
            _record_failure(key)
            raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)
        user = auth_service.get_user(data.username)
        if not user or not verify_credential(user, data.password):
            _record_failure(key)
            raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)

    _clear_attempts(key)
    access = auth_service.issue_access_token(user["username"], user["role"], config.AUTH_SECRET_KEY)
    refresh = auth_service.issue_refresh_token(user["username"], user["role"], config.AUTH_SECRET_KEY)
    _set_auth_cookies(response, access, refresh)
    return {"user": _public_user(user)}


# ─────────────────────────── Registration ──────────────────────────────
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=8, max_length=256)


@router.post("/register", response_model=UserResponse)
def register(data: RegisterRequest):
    """Self‑registration: new users default to the 'investigator' role (can add cases)."""
    if auth_service.get_user(data.username.strip()):
        raise HTTPException(status_code=409, detail="Username already exists.")
    role = "investigator"
    auth_service.upsert_user(
        username=data.username.strip(),
        role=role,
        display_name=data.username,
        email="",
        password_hash=auth_service.hash_password(data.password),
        active=True,
    )
    user = auth_service.get_user(data.username.strip())
    return UserResponse(
        username=user["username"],
        display_name=user.get("display_name", ""),
        email=user.get("email", ""),
        role=user.get("role", ""),
        active=user.get("active", True),
    )


def verify_credential(user: dict, password: str) -> bool:
    return bool(auth_service.verify_password(password, user.get("password_hash", "")))


@router.post("/refresh", response_model=AuthSuccessResponse)
def refresh(request: Request, response: Response):
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    claims = auth_service.decode_jwt(refresh_token, config.AUTH_SECRET_KEY)
    if (
        not claims
        or claims.get("type") != "refresh"
        or auth_service.is_refresh_token_revoked(claims.get("jti"))
    ):
        _clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Rotate: issue a fresh access token and a fresh refresh token.
    username = claims.get("sub") or ""
    role = claims.get("role") or ""
    user = auth_service.get_user(username)
    if not user or not user.get("active") or user.get("role") != role:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Not authenticated")

    auth_service.revoke_refresh_token(claims.get("jti"))
    access = auth_service.issue_access_token(user["username"], user["role"], config.AUTH_SECRET_KEY)
    new_refresh = auth_service.issue_refresh_token(user["username"], user["role"], config.AUTH_SECRET_KEY)
    _set_auth_cookies(response, access, new_refresh)
    return {"user": _public_user(user)}


@router.post("/logout")
def logout(request: Request, response: Response):
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if refresh_token:
        claims = auth_service.decode_jwt(refresh_token, config.AUTH_SECRET_KEY)
        if claims:
            auth_service.revoke_refresh_token(claims.get("jti"))
    _clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return {"user": _public_user(current_user)}


@router.get("/users", response_model=List[UserResponse])
def list_users(_: dict = Depends(require_roles(ROLE_ADMIN))):
    users = auth_service.list_users()
    return [UserResponse(
        username=u["username"],
        display_name=u.get("display_name", ""),
        email=u.get("email", ""),
        role=u.get("role", ""),
        active=bool(u.get("active", True)),
    ) for u in users]


@router.post("/users", response_model=UserResponse)
def create_user(data: UserCreate, _: dict = Depends(require_roles(ROLE_ADMIN))):
    role = data.role.strip().lower()
    if role not in (ROLE_ADMIN, "investigator", "analyst"):
        raise HTTPException(status_code=422, detail="Invalid role. Use admin, investigator or analyst.")
    if auth_service.get_user(data.username.strip()):
        raise HTTPException(status_code=409, detail="Username already exists.")
    auth_service.upsert_user(
        username=data.username.strip(),
        role=role,
        display_name=data.display_name,
        email=data.email,
        password_hash=auth_service.hash_password(data.password),
        active=True,
    )
    user = auth_service.get_user(data.username.strip())
    return UserResponse(
        username=user["username"],
        display_name=user.get("display_name", ""),
        email=user.get("email", ""),
        role=user.get("role", ""),
        active=user.get("active", True),
    )