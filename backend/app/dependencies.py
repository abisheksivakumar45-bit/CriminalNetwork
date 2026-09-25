"""FastAPI dependencies enforcing authentication and role-based access control.

Every protected endpoint resolves the current user from the httpOnly access
cookie. Roles are always read from the authoritative AuthUser store in the
database — never trusted from the client.
"""
from typing import Callable

from fastapi import Depends, HTTPException, Request

from app.services import auth_service
import config

ACCESS_COOKIE = "crime_net_access"
REFRESH_COOKIE = "crime_net_refresh"

ROLE_ADMIN = "admin"
ROLE_INVESTIGATOR = "investigator"
ROLE_ANALYST = "analyst"

WRITE_ROLES = (ROLE_ADMIN, ROLE_INVESTIGATOR)   # can create cases, entities, relationships
ADMIN_ONLY = (ROLE_ADMIN,)
ANY_AUTH_ROLE = (ROLE_ADMIN, ROLE_INVESTIGATOR, ROLE_ANALYST)  # every authenticated role may read


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=401, detail="Not authenticated")


def get_current_user(request: Request) -> dict:
    """Resolve the authenticated user from the access-token cookie."""
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise _unauthorized()
    claims = auth_service.decode_jwt(token, config.AUTH_SECRET_KEY)
    if not claims or claims.get("type") != "access":
        raise _unauthorized()
    # Reject access tokens that were explicitly revoked at logout.
    if auth_service.is_access_token_revoked(claims.get("jti")):
        raise _unauthorized()
    username = claims.get("sub") or ""
    user = auth_service.get_user(username)
    if not user or not user.get("active"):
        raise _unauthorized()
    # Role must match the authoritative store (a stale/forged token is rejected)
    if user.get("role") != claims.get("role"):
        raise _unauthorized()
    return {
        "username": user["username"],
        "role": user["role"],
        "display_name": user.get("display_name", ""),
        "email": user.get("email", ""),
    }


def require_roles(*roles: str) -> Callable:
    """Dependency factory: allow only the given roles, else raise 403."""
    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return checker