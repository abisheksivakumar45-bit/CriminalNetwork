from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import CORS_ORIGINS
from app.routers import entities, relationships, crimes, analysis, init_data

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

app.include_router(entities.router)
app.include_router(relationships.router)
app.include_router(crimes.router)
app.include_router(analysis.router)
app.include_router(init_data.router)


@app.on_event("startup")
def startup_event():
    """Auto-load sample data on first startup if database is empty."""
    from app.services.database import db_service
    from app.services.sample_data import load_sample_data

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
        return {"status": "unhealthy", "neo4j": str(e)}
