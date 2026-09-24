"""Authentication primitives and the AuthUser store.

Paswords are hashed with ``hashlib.scrypt`` (a memory-hard, NIST-approved
password KDF available in the Python standard library — no third-party
dependency required). Tokens are standard HMAC-SHA256 JWTs (RFC 7519)
signed with an environment-provided secret.

Auth users live in Neo4j under the dedicated ``AuthUser`` label — kept
fully separate from the criminal/intelligence graph (``Entity``,
``CrimeRecord``, relationships) so user data never mixes with
investigation entities.
"""
import hashlib
import hmac
import json
import base64
import secrets
import time
import threading
from typing import Dict, List, Optional

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config
from app.services import database as database_module

db_service = database_module.db_service

# ─────────────────────────── Password hashing ───────────────────────────
SCRYPT_N = 2 ** 14   # CPU/memory cost
SCRYPT_R = 8         # block size
SCRYPT_P = 1         # parallelisation
SCRYPT_DKLEN = 32
SCRYPT_MAXMEM = 64 * (2 ** 20)


def hash_password(password: str) -> str:
    """Hash a password with scrypt. Returns a self-describing string."""
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R,
        p=SCRYPT_P, dklen=SCRYPT_DKLEN, maxmem=SCRYPT_MAXMEM,
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time password verification. Never reveals why it failed."""
    try:
        algo, n_s, r_s, p_s, salt_hex, hash_hex = stored.split("$")
        if algo != "scrypt":
            return False
        expected = bytes.fromhex(hash_hex)
        dk = hashlib.scrypt(
            password.encode("utf-8"), salt=bytes.fromhex(salt_hex),
            n=int(n_s), r=int(r_s), p=int(p_s),
            dklen=len(expected), maxmem=SCRYPT_MAXMEM,
        )
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


# ─────────────────────────── JWT (HMAC-SHA256) ──────────────────────────
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _sign(segment: str, secret: str) -> str:
    return _b64url(hmac.new(secret.encode("utf-8"), segment.encode("ascii"), hashlib.sha256).digest())


def encode_jwt(claims: dict, secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    body_b64 = _b64url(json.dumps(claims, separators=(",", ":")).encode("utf-8"))
    unsigned = f"{header_b64}.{body_b64}"
    return f"{unsigned}.{_sign(unsigned, secret)}"


def decode_jwt(token: str, secret: str) -> Optional[dict]:
    """Return claims only when signature AND expiry are valid. Otherwise None."""
    try:
        header_b64, body_b64, signature = token.split(".")
        if len(token) > 8192:
            return None
        unsigned = f"{header_b64}.{body_b64}"
        if not hmac.compare_digest(signature, _sign(unsigned, secret)):
            return None
        header = json.loads(_b64url_decode(header_b64))
        if header.get("alg") != "HS256":
            return None
        claims = json.loads(_b64url_decode(body_b64))
        if not isinstance(claims, dict):
            return None
        exp = claims.get("exp")
        if isinstance(exp, (int, float)) and time.time() >= exp:
            return None
        return claims
    except Exception:
        return None


def new_token_id() -> str:
    return secrets.token_urlsafe(24)


def issue_access_token(username: str, role: str, secret: str) -> str:
    now = int(time.time())
    claims = {
        "sub": username,
        "role": role,
        "type": "access",
        "jti": new_token_id(),
        "iat": now,
        "exp": now + config.AUTH_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
    return encode_jwt(claims, secret)


def issue_refresh_token(username: str, role: str, secret: str) -> str:
    now = int(time.time())
    claims = {
        "sub": username,
        "role": role,
        "type": "refresh",
        "jti": new_token_id(),
        "iat": now,
        "exp": now + config.AUTH_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    }
    return encode_jwt(claims, secret)


# Refresh-token revocation (in-memory; resets on restart — prototype scope)
_revoked_refresh: Dict[str, float] = {}
_revoked_lock = threading.Lock()


def revoke_refresh_token(jti: Optional[str]):
    if not jti:
        return
    with _revoked_lock:
        _revoked_refresh[jti] = time.time() + 86400  # prune window


def is_refresh_token_revoked(jti: Optional[str]) -> bool:
    if not jti:
        return False
    with _revoked_lock:
        now = time.time()
        expired = [k for k, v in _revoked_refresh.items() if v < now]
        for k in expired:
            _revoked_refresh.pop(k, None)
        return jti in _revoked_refresh


# ─────────────────────────── AuthUser store (Neo4j) ─────────────────────
def _auth_user_from_record(record: dict) -> Optional[dict]:
    node = record.get("u")
    if not node:
        return None
    data = dict(node)
    return {
        "username": data.get("username", ""),
        "display_name": data.get("display_name", ""),
        "email": data.get("email", ""),
        "role": data.get("role", ""),
        "active": bool(data.get("active", True)),
        "created_at": data.get("created_at", ""),
    }


def get_user(username: str) -> Optional[dict]:
    result = db_service._run_query(
        "MATCH (u:AuthUser {username: $username}) RETURN u",
        {"username": username},
    )
    if not result:
        return None
    data = dict(result[0]["u"])
    return {
        "username": data.get("username", ""),
        "display_name": data.get("display_name", ""),
        "email": data.get("email", ""),
        "role": data.get("role", ""),
        "active": bool(data.get("active", True)),
        "password_hash": data.get("password_hash", ""),
        "created_at": data.get("created_at", ""),
    }


def ensure_auth_schema():
    """Idempotent index/constraint bootstrap for the AuthUser store."""
    try:
        db_service._run_write(
            "CREATE CONSTRAINT auth_username_uniq IF NOT EXISTS "
            "FOR (u:AuthUser) REQUIRE u.username IS UNIQUE"
        )
    except Exception as e:
        print(f"Auth: constraint setup warning: {e}")


def upsert_user(username: str, role: str, display_name: str = "", email: str = "",
                password_hash: str = "", active: bool = True):
    db_service._run_write(
        """
        MERGE (u:AuthUser {username: $username})
        SET u.display_name = $display_name, u.email = $email, u.role = $role,
            u.active = $active, u.updated_at = $updated_at
        """,
        {
            "username": username,
            "display_name": display_name or username,
            "email": email,
            "role": role,
            "active": bool(active),
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        },
    )
    if password_hash:
        db_service._run_write(
            "MATCH (u:AuthUser {username: $username}) SET u.password_hash = $hash",
            {"username": username, "hash": password_hash},
        )


def list_users() -> List[dict]:
    result = db_service._run_query(
        "MATCH (u:AuthUser) RETURN u ORDER BY u.role, u.username"
    )
    return [u for u in (_auth_user_from_record(r) for r in result) if u]


def _demo_config_for(username: str) -> Optional[dict]:
    """Return the environment-configured demo account entry for a username (case-insensitive)."""
    if not config.AUTH_DEMO_ENABLED:
        return None
    needle = (username or "").strip().lower()
    for entry in config.AUTH_DEMO_USERS:
        entry_username = (entry.get("username") or "").strip()
        if entry_username.lower() == needle and entry.get("password"):
            return entry
    return None


def reconcile_demo_password(username: str) -> bool:
    """Self-healing credential sync for DEMO-only accounts.

    Demo accounts are seeded at startup from ``AUTH_DEMO_*_PASSWORD``. If the
    stored hash no longer verifies against the CURRENT configured demo password
    (e.g. .env was edited and the container not recreated, or the Neo4j volume
    was reused from a different deployment), login would otherwise return a
    confusing "Invalid username or password." until a manual re-seed.

    When a demo account exists and its hash no longer matches the configured
    demo password, this re-derives the hash from the environment and updates
    the store so the account keeps working. It never touches non-demo accounts
    and never hardcodes a password.
    """
    entry = _demo_config_for(username)
    if not entry:
        return False
    user = get_user(username)
    if user and verify_password(entry["password"], user.get("password_hash", "")):
        return True
    upsert_user(
        username=entry["username"].strip(),
        role=entry["role"],
        display_name=entry.get("display_name", ""),
        email=entry.get("email", ""),
        password_hash=hash_password(entry["password"]),
        active=True,
    )
    refreshed = get_user(entry["username"].strip())
    return bool(refreshed and verify_password(entry["password"], refreshed.get("password_hash", "")))


def seed_demo_users():
    """Seed DEMO accounts from environment configuration (clearly marked demo)."""
    if not config.AUTH_DEMO_ENABLED:
        print("Auth: demo seeding disabled (AUTH_DEMO_ENABLED=false).")
        return
    ensure_auth_schema()
    created = 0
    for user in config.AUTH_DEMO_USERS:
        username = (user.get("username") or "").strip()
        password = user.get("password") or ""
        if not username or not password:
            print(
                f"Auth: skipping demo user {username or '(empty username)'} "
                "- no password configured via AUTH_DEMO_*_PASSWORD."
            )
            continue
        password_hash = hash_password(password)
        upsert_user(
            username=username,
            role=user["role"],
            display_name=user.get("display_name", ""),
            email=user.get("email", ""),
            password_hash=password_hash,
            active=True,
        )
        created += 1
    print(f"Auth: seeded {created} demo account(s) into {config.NEO4J_DATABASE} ... (DEMO ONLY - not production credentials)")