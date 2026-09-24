import os
import secrets
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")
APP_HOST = os.getenv("APP_HOST", "0.0.0.0")
APP_PORT = int(os.getenv("APP_PORT", "8000"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
SPACY_MODEL = os.getenv("SPACY_MODEL", "en_core_web_sm")

# ─── Authentication / RBAC ───
# JWT signing secret. MUST come from the environment in any real deployment.
# If absent, a random ephemeral secret is generated so the app still boots —
# tokens are then invalidated on every restart. See .env / .env.example.
AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "") or secrets.token_urlsafe(48)

# Token lifetimes
AUTH_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("AUTH_ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
AUTH_REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("AUTH_REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Cookie flags
AUTH_COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "false").lower() in ("1", "true", "yes")

# Brute-force protection (per username + client IP)
AUTH_LOGIN_MAX_ATTEMPTS = int(os.getenv("AUTH_LOGIN_MAX_ATTEMPTS", "5"))
AUTH_LOGIN_LOCKOUT_SECONDS = int(os.getenv("AUTH_LOGIN_LOCKOUT_SECONDS", "300"))

# Registration policy.
# Analyst self-registration is always allowed. Investigator self-registration
# is only allowed when explicitly enabled (demo/development). Admin can never
# be self-registered — admin accounts exist only through the seeded demo
# accounts or an existing admin creating them.
ALLOW_SELF_REGISTER_INVESTIGATOR = os.getenv("ALLOW_SELF_REGISTER_INVESTIGATOR", "false").lower() in ("1", "true", "yes")

# Demo accounts (clearly DEMO-only, never production credentials).
# Accounts are seeded into the separate AuthUser store at startup when
# AUTH_DEMO_ENABLED is true. Passwords are read from the environment only;
# a user with an empty password env var is skipped.
AUTH_DEMO_ENABLED = os.getenv("AUTH_DEMO_ENABLED", "true").lower() in ("1", "true", "yes")

AUTH_DEMO_USERS = [
    {
        "username": os.getenv("AUTH_DEMO_ADMIN_USERNAME", "admin"),
        "password": os.getenv("AUTH_DEMO_ADMIN_PASSWORD", ""),
        "role": "admin",
        "display_name": os.getenv("AUTH_DEMO_ADMIN_DISPLAY_NAME", "Administrator"),
        "email": os.getenv("AUTH_DEMO_ADMIN_EMAIL", "admin@crimenet.demo"),
    },
    {
        "username": os.getenv("AUTH_DEMO_INVESTIGATOR_USERNAME", "investigator"),
        "password": os.getenv("AUTH_DEMO_INVESTIGATOR_PASSWORD", ""),
        "role": "investigator",
        "display_name": os.getenv("AUTH_DEMO_INVESTIGATOR_DISPLAY_NAME", "Senior Investigator"),
        "email": os.getenv("AUTH_DEMO_INVESTIGATOR_EMAIL", "investigator@crimenet.demo"),
    },
    {
        "username": os.getenv("AUTH_DEMO_ANALYST_USERNAME", "analyst"),
        "password": os.getenv("AUTH_DEMO_ANALYST_PASSWORD", ""),
        "role": "analyst",
        "display_name": os.getenv("AUTH_DEMO_ANALYST_DISPLAY_NAME", "Intelligence Analyst"),
        "email": os.getenv("AUTH_DEMO_ANALYST_EMAIL", "analyst@crimenet.demo"),
    },
]