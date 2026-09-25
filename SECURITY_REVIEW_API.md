# Security Review — Feature #2: API Security & Input Validation

**System:** Criminal Network Analysis System (SIH26189)
**Scope:** Backend API hardening + frontend client-side error/403/422 handling.
**Status:** All 100 automated checks pass (`security_tests.py`); 3 latent bugs found during verification and fixed.

---

## 1. Authentication & session integrity
- Every `/api/*` route except `/api/auth/login`, `/api/auth/register`, `/api/health` requires a valid session → `401 {"detail":"Not authenticated"}` when missing (`app/dependencies.py`).
- Login is enumeration-safe: wrong password, unknown user, and bad role all return the same generic `"Invalid username or password"`.
- Logout now **revokes the current access token** (jti tracked in-memory in `auth_service.py`, enforced in `get_current_user`), so a dumped/stale access JWT stops working at sign-out instead of living until its 15-minute expiry.
- Refresh tokens continue to rotate and are revoked on logout; access tokens carry `type=access` claims and a prototype in-memory revoked store (documented limitation: resets on backend restart).
- Login lockout: 5 failed attempts → 300 s block (`AUTH_LOGIN_MAX_ATTEMPTS`, `AUTH_LOGIN_LOCKOUT_SECONDS`).

## 2. Role-based access control on all state-changing endpoints (regression-guarded)
- `analyst` = read-only: all POST/DELETE/PATCH (crimes, entities, relationships, users, role changes, init endpoints) → `403`; user management + init endpoints additionally `403` for `investigator`.
- `admin` creates users / changes roles; `investigator` writes content (crime/entity/relationship) but cannot read the user store.
- Self-registration is role-gated: registering as admin → `403`; as investigator only honored behind `AUTH_ALLOW_INVESTIGATOR_REGISTRATION`; duplicates → `409`.

## 3. Pydantic input validation (422 contract)
- String caps: case title 200, entity name 200, `fir_number` 64, search `q`/`path` 200, source/target/entity ids 64, password/username bounds.
- Enums: `CaseStatus` (`open/investigating/closed`), `entity_type`, `relationship_type`.
- Dates must be `YYYY-MM-DD`; blank title/description rejected; template strings (`{}` etc.) rejected.
- `properties` map: ≤ 50 keys, keys ≤ 64 chars, values ≤ 500 chars.
- `max_depth` clamped/validated to 1..10 on all path endpoints.

## 4. Payload-size limits → 413
- `RequestSizeLimitMiddleware` (`main.py`) caps request bodies (~256 KB) → `413 Request Entity Too Large` before any parsing/NLP.
- nginx `client_max_body_size 512k;` (`frontend/nginx.conf`) — backend rejects first, nginx is a backstop.
- `description` max 20000 chars stays under both limits; 20001 chars → `422` (schema), 260 KB+ bodies → `413` (middleware).

## 5. Neo4j/Cypher injection resistance
- All user input bound as Cypher parameters (no f-string interpolation of values — verified earlier in RBAC task).
- Free-form relationship-type labels are the only interpolated values and pass `_REL_TYPE_PATTERN` (`^[A-Z][A-Z0-9_]*$`) via `_sanitize_rel_type` before use (`database.py`) — rejected otherwise.
- Explicit injection probes (quotes, `' OR 1=1`, `UNWIND`, comment injection) return controlled 200/422 and leave data untouched.

## 6. Resource-robustness (unhandled-500 class fixed)
- **Fixed:** a 20 000-char description crashed `POST /api/crimes/` — NLP-extracted entity name (~20 KB) exceeded Neo4j's range-index limit for `entity_name` (`Neo.DatabaseError.Statement.ExecutionFailed`). Entity names are now capped at 200 chars in both `nlp_service.extract_entities` and `find_or_create_entity`.
- **Fixed:** `GET /api/path` with `source_id == target_id` caused Neo4j `shortestPath` to raise → 500. `find_path` now returns `paths: []` for self-paths and clamps/validates depth.
- Both originally surfaced as generic 500s thanks to the global handler, which now logs the full traceback server-side only.

## 7. Error handling & information leakage
- Global exception handler returns a generic message (no stack traces, no DB strings, no internal paths); `/api/health` stays clean.
- Consistent `401/403/404/409/422` bodies; 500s are opaque to clients but fully logged server-side.

## 8. CORS hardening
- Explicit `allow_origins` allowlist in `config.py` (origin `*` is stripped). Verified live: `http://localhost:5173` allowed, `http://evil.example.com` rejected.

## 9. Security headers & transport hygiene
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` emitted on nginx and API responses (verified from host).
- Auth cookies `HttpOnly` + `SameSite=Lax`; secrets live in `.env` (git-ignored), `.env.example` holds placeholders only.

## 10. Data integrity & startup invariants
- **Fixed defect:** `/api/init/load-sample-data` (admin) previously cascaded into `clear_database()` wiping **all** nodes, including the `AuthUser` store — every login/token then 401ed. `clear_database()` now preserves `AuthUser` (`MATCH (n) WHERE NOT n:AuthUser ...`). Verified live: sample re-load keeps all 4 accounts.
- Reruns of sample-data load are idempotent; final data snapshot verified over authenticated API (67 entities / 8 crimes) with the 4 baseline users (`admin, analyst, investigator, abishek`).

---

## Verification evidence
- **100/100 automated checks pass** across 13 categories: unauthenticated access (7), logins (8), RBAC analyst (10), RBAC investigator (4), RBAC admin (4), validation (23), oversize→413 (4), XSS/injection (6), core flows (18), register/roles (7), logout/token revocation (3), headers/CORS/health (6), data snapshot (2+).
- Fixes surfaced and closed during verification: (1) Entity/entity_name index crash on 20 KB names, (2) `shortestPath` self-pair 500, (3) logout not revoking the access token.
- 3 further test-hygiene failures (leftover `secprobe_*` accounts → 409) resolved by making the suite idempotent (pre-run cleanup).

## Caveats (inherited)
- `abishek` password: the earlier account-store wipe destroyed the original hash, so `abishek` was re-created with demo password `ChangeThisDemoPassword` — rotate before production.
- Access/refresh-token revocation stores are in-memory (prototype scope): revocation is lost on backend restart; not a substitute for blacklists backed by shared storage in production.
- Auth `AUTH_SECRET_KEY` is set in `.env`; validate length on deploy, never commit it.

## Out of scope for this feature (later)
- Database-level hardening / encryption-at-rest, full TLS termination, audit logging, monitoring/alerting, dependency scanning (SCA), and penetration testing.