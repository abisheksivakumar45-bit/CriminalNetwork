# AI-Powered Criminal Network Analysis System

**SIH26189 - Smart India Hackathon**

A fully functional prototype for criminal network analysis using AI/NLP, graph databases, and network analysis.

> **Disclaimer:** This application uses synthetic/demo data only. It does not use real police, NCRB, CBI, NIA, or IB data. Risk scores and network analysis are based on graph metrics and do not predict actual criminal activity.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS + D3.js |
| Backend | Python + FastAPI |
| Database | Neo4j |
| NLP | spaCy (en_core_web_sm) |
| Analysis | NetworkX |

## Features

- **Dashboard** - Overview of cases, entities, relationships, and suspicious patterns
- **Crime Records** - FIR/intelligence report management with NLP entity extraction
- **Knowledge Graph** - Interactive D3.js network visualization with entity type filtering
- **Network Analysis** - Centrality scores, risk assessment, community detection
- **Entity Search** - Full-text search across all entity types
- **Natural Language Investigation Search** - Ask investigation questions in plain English
- **Investigation View** - Detailed entity profile with connections and mini-graph
- **Add Case** - Add new FIR text and extract entities using NLP

## Quick Start (One Command)

### Prerequisites
- [Docker Desktop](https://docker.com) installed and running

### Windows
```
Double-click START_PROJECT.bat
```

### Linux/Mac
```bash
chmod +x start.sh
./start.sh
```

### What Happens
1. Docker builds and starts Neo4j, Backend, and Frontend
2. On first run, sample data (8 FIR records, 67 entities, 85+ relationships) is loaded automatically
3. Browser opens to http://localhost:5173
4. On subsequent starts, existing data is preserved (no duplicates)

### Services
| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React application |
| Backend API | http://localhost:8000 | FastAPI REST API |
| API Docs | http://localhost:8000/docs | Swagger documentation |
| Neo4j Browser | http://localhost:7474 | Database browser (login: neo4j/password123) |

## Stopping the Project

### Windows
```
Double-click STOP_PROJECT.bat
```

### Linux/Mac
```bash
./stop.sh
```

### Manual
```bash
docker compose down
```

> Data is preserved in Docker volumes. Use `docker compose down -v` to remove all data.

## Project Structure

```
CriminalNetwork/
├── backend/
│   ├── app/
│   │   ├── models/schemas.py      # Pydantic models
│   │   ├── routers/               # FastAPI endpoints
│   │   │   ├── entities.py        # Entity CRUD
│   │   │   ├── relationships.py   # Relationship CRUD
│   │   │   ├── crimes.py          # Crime records
│   │   │   ├── analysis.py        # Network analysis & search
│   │   │   ├── natural_search.py  # Natural language investigation search
│   │   │   └── init_data.py       # Sample data loader
│   │   └── services/
│   │       ├── database.py        # Neo4j service
│   │       ├── nlp_service.py     # spaCy NLP extraction
│   │       ├── natural_search.py  # Controlled NL parser + query executors
│   │       ├── network_analysis.py # NetworkX analysis
│   │       └── sample_data.py     # Demo data
│   ├── main.py                    # FastAPI app entry
│   ├── config.py                  # Configuration
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Cases.jsx
│   │   │   ├── NetworkGraph.jsx   # D3.js visualization
│   │   │   ├── Analysis.jsx
│   │   │   ├── Search.jsx
│   │   │   ├── NaturalSearch.jsx  # Natural language investigation search
│   │   │   ├── Investigation.jsx
│   │   │   └── AddCase.jsx
│   │   ├── components/Sidebar.jsx
│   │   ├── api.js                 # API client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── nginx.conf                 # Reverse proxy config
│   └── Dockerfile
├── docker-compose.yml
├── .env                           # Environment variables (git-ignored)
├── .env.example                   # Template for .env
├── START_PROJECT.bat              # Windows startup script
├── STOP_PROJECT.bat               # Windows stop script
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Dashboard statistics |
| GET | `/api/entities/` | List all entities |
| GET | `/api/entities/{id}` | Get entity details |
| GET | `/api/entities/search/{query}` | Search entities |
| GET | `/api/relationships/` | List relationships |
| GET | `/api/relationships/connected/{id}` | Get connected entities |
| GET | `/api/crimes/` | List crime records |
| POST | `/api/crimes/` | Create crime record (NLP extraction) |
| GET | `/api/network` | Full network data |
| GET | `/api/search?q=` | Search entities and relationships |
| GET | `/api/investigation/{id}` | Full investigation view |
| POST | `/api/investigation/natural-search` | Natural language investigation search |
| GET | `/api/path?source_id=&target_id=` | Find path between entities |
| POST | `/api/init/load-sample-data` | Load demo data |
| POST | `/api/init/clear` | Clear database |

## Natural Language Investigation Search

Investigators can ask controlled investigation questions in plain English and get answers
drawn **only from the existing case graph** — no synthetic entities or cases are ever fabricated.

### Supported query types

| Intent | Example |
|--------|---------|
| Entities connected to an entity | `Show all entities connected to Rajesh Kumar.` |
| Type-filtered connected entities | `Show organizations connected to Rajesh Kumar.` |
| Connected through an intermediate type | `Show people connected to Rajesh Kumar through organizations.` |
| Phone lookups by digits | `Show people connected to phone 9876543210.` |
| Entities appearing in more than N cases | `Find entities appearing in more than two cases.` (`at least N` also supported) |
| Cases involving an entity | `Show cases involving Rajesh Kumar.` |
| Entities in a specific case | `Show entities connected to entities in case FIR-2024-001.` (FIR `FIR 2024 001` / `FIR2024-001` normalize the same) |

### How it works (controlled, explainable, safe)
- A **deterministic rule-based parser** converts the text into a structured intent
  (`operation`, `target_entity`, `target_type`, `via_type`, `threshold`, `condition`, `case_ref`)
  that is shown back to the investigator in an interpretation panel before results.
- **Entity resolution** priority: explicit `entity_id` (disambiguation) → case-insensitive exact
  name → normalized phone digits (`9876543210` → `+919876543210`) → case-insensitive substring.
  Multiple matches return an `ambiguous` response with selectable candidates (≤10).
- **Security:** the user's free text is never concatenated into Cypher. Only whitelisted,
  parameterized queries are executed, and every query is capped (50 rows). This is an
  investigator-assistance tool, so it does **not** claim to understand unrestricted English —
  anything outside the supported patterns returns `unsupported` with the example list.
- **Transparency:** every response includes the original query, interpreted summary, structured
  interpretation, `status` (`ok`/`empty`/`not_found`/`ambiguous`/`unsupported`), results, and a
  `graph` payload that can be opened on the Knowledge Graph page.

### Endpoint
`POST /api/investigation/natural-search` — body `{ "query": "...", "entity_id": "optional" }`.
Read-only and available to `admin`, `investigator`, and `analyst`; unauthenticated requests get
`401`. Queries are validated (1–500 characters, not blank → else `422`).

## Authentication & Role-Based Access Control

All API routes now require authentication except `/api/auth/login`, `/api/auth/refresh`,
`/api/auth/logout`, `/health`, and the OpenAPI docs. The SPA redirects unauthenticated
users to a dedicated login page.

### Demo accounts (DEMO ONLY — not production credentials)

| Username | Password | Role capabilities |
|----------|----------|-------------------|
| `admin` | `ChangeThisDemoPassword` | Full access + user management |
| `investigator` | `ChangeThisDemoPassword` | Investigation + add cases |
| `analyst` | `ChangeThisDemoPassword` | Read-only investigation (no Add Case) |

The demo password is configured through environment variables
(`AUTH_DEMO_*_PASSWORD` in `.env`). Change it there — never past it into code.

### How it works
- Passwords are hashed with **scrypt** (memory-hard; no plaintext/hash exposure).
- Sessions use short-lived **HS256 JWTs** (15 min) stored in **httpOnly, SameSite=Lax**
  cookies scoped to `/api`, refreshed with a rotating refresh cookie (7 days).
- Roles are validated **server-side** on every request from the Neo4j `AuthUser` store
  (never trusted from the client): 401 = unauthenticated, 403 = insufficient permission.
- Basic brute-force protection: after 5 failed logins per account, login is blocked for
  5 minutes (configured via `AUTH_LOGIN_MAX_ATTEMPTS` / `AUTH_LOGIN_LOCKOUT_SECONDS`).

## Configuration

Environment variables are configured in the `.env` file:

```bash
# Neo4j Credentials
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123

# CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Auth / RBAC (see .env.example for the full list)
AUTH_SECRET_KEY=your-long-random-secret
AUTH_ACCESS_TOKEN_EXPIRE_MINUTES=15
AUTH_REFRESH_TOKEN_EXPIRE_DAYS=7
AUTH_DEMO_ADMIN_USERNAME=admin
AUTH_DEMO_ADMIN_PASSWORD=ChangeThisDemoPassword
AUTH_DEMO_INVESTIGATOR_USERNAME=investigator
AUTH_DEMO_INVESTIGATOR_PASSWORD=ChangeThisDemoPassword
AUTH_DEMO_ANALYST_USERNAME=analyst
AUTH_DEMO_ANALYST_PASSWORD=ChangeThisDemoPassword
```

> `.env` is git-ignored. Copy `.env.example` and fill in real values. Never commit secrets.
> This is a prototype: switch to a hardened identity provider (Keycloak/Auth0/OIDC),
> Argon2/bcrypt, HTTPS, a server-side session store, and stronger rate limiting for production.

## Troubleshooting

### Docker Desktop not starting
- Ensure Docker Desktop is installed and running
- Check system requirements (WSL2 enabled on Windows)

### Backend fails to start
```bash
docker compose logs backend
```
- Usually caused by Neo4j not being ready. The backend retries connection for 60 seconds.

### Port already in use
```bash
# Find process using port 5173 or 8000
netstat -ano | findstr :5173
netstat -ano | findstr :8000

# Stop the conflicting process or change ports in docker-compose.yml
```

### Reset everything (fresh start)
```bash
docker compose down -v    # Remove all data
docker compose up -d --build  # Rebuild and start
```

### Check service health
```bash
docker compose ps                    # View service status
docker compose logs -f backend       # Watch backend logs
curl http://localhost:8000/health     # Check backend health
```

## How It Works

1. **Crime Data Ingestion** - FIR text is entered via the UI
2. **NLP Entity Extraction** - spaCy + regex extract persons, phones, vehicles, locations, organizations
3. **Knowledge Graph** - Entities and relationships stored in Neo4j
4. **Network Analysis** - NetworkX calculates centrality, detects communities, identifies patterns
5. **Investigation** - Interactive D3.js graph + entity profiles + risk scores

## Sample Data

The system comes with 8 synthetic FIR records covering:
- Bank heist
- Drug trafficking
- Cyber fraud
- Arms smuggling
- Human trafficking
- Money laundering
- Kidnapping
- Gold smuggling

With 20+ persons, 10 organizations, 12 phones, 10 vehicles, 15 locations, and 85+ relationships.
