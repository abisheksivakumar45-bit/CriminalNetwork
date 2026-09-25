import logging
import sys
import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import CORS_ORIGINS
from app.routers import auth, entities, relationships, crimes, analysis, init_data, natural_search

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("crimenet")

app = FastAPI(
    title="Criminal Network Analysis System",
    description="AI-Powered Criminal Network Analysis for SIH26189",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Security middleware ───
# Request-size protection: reject oversized request bodies before they are read.
MAX_REQUEST_BODY_BYTES = 256 * 1024  # 256 KB


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_REQUEST_BODY_BYTES:
                    return JSONResponse(status_code=413, content={"detail": "Request body too large."})
            except ValueError:
                pass
        return await call_next(request)


# Basic security headers on every API response.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for header, value in SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)

app.include_router(entities.router)
app.include_router(relationships.router)
app.include_router(crimes.router)
app.include_router(analysis.router)
app.include_router(init_data.router)
app.include_router(auth.router)
app.include_router(natural_search.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all: log full details server-side, return a safe generic response."""
    logger.error(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        exc,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


def _warn_about_ephemeral_secret():
    import os
    if not (os.getenv("AUTH_SECRET_KEY") or "").strip():
        print(
            "WARNING: AUTH_SECRET_KEY is not set. JWT signing uses a random "
            "ephemeral secret — sessions will be invalidated on restart. "
            "Set AUTH_SECRET_KEY in .env for persistent signing."
        )


@app.on_event("startup")
def startup_event():
    """Auto-load sample data on first startup if database is empty, then seed demo auth users."""
    from app.services.database import db_service
    from app.services.sample_data import load_sample_data
    from app.services import auth_service

    _warn_about_ephemeral_secret()

    print("Startup: Waiting for Neo4j to be ready...")
    max_retries = 30
    for attempt in range(max_retries):
        try:
            db_service.ensure_connected()
            result = db_service._run_query("MATCH (n:Entity) RETURN count(n) as count")
            entity_count = result[0]["count"] if result else 0

            if entity_count == 0:
                print("Startup: Database is empty. Loading sample data...")
                load_sample_data(db_service)
                print("Startup: Sample data loaded successfully.")
            else:
                print(f"Startup: Database has {entity_count} entities. Skipping sample data load.")

            auth_service.seed_demo_users()
            return
        except Exception as e:
            print(f"Startup: Attempt {attempt + 1}/{max_retries} - Neo4j not ready: {e}")
            time.sleep(2)

    print("Startup: WARNING - Could not connect to Neo4j after retries. Services may not work.")


@app.get("/")
def root():
    return {
        "message": "Criminal Network Analysis System API",
        "version": "1.0.0",
        "auth": {
            "login": "POST /api/auth/login",
            "refresh": "POST /api/auth/refresh",
            "logout": "POST /api/auth/logout",
            "me": "GET /api/auth/me",
        },
        "endpoints": {
            "docs": "/docs",
            "dashboard": "/api/dashboard",
            "entities": "/api/entities",
            "relationships": "/api/relationships",
            "crimes": "/api/crimes",
            "network": "/api/network",
            "search": "/api/search?q=",
            "investigation": "/api/investigation/{entity_id}",
            "init_data": "/api/init/load-sample-data",
        }
    }


@app.get("/health")
def health():
    try:
        from app.services.database import db_service
        db_service._run_query("RETURN 1")
        return {"status": "healthy", "neo4j": "connected"}
    except Exception as e:
        # Never leak DB details to clients; log them server-side only.
        logger.error("Health check failed: %s", e, exc_info=True)
        return {"status": "unhealthy", "neo4j": "connection unavailable"}