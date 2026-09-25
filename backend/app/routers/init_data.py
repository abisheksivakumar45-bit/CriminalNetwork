import logging
from fastapi import APIRouter, Depends, HTTPException
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.database import db_service
from app.services.sample_data import load_sample_data
from app.dependencies import require_roles, ADMIN_ONLY

logger = logging.getLogger("crimenet.init")

router = APIRouter(
    prefix="/api/init",
    tags=["init"],
    dependencies=[Depends(require_roles(*ADMIN_ONLY))],
)


@router.post("/load-sample-data")
def init_sample_data():
    try:
        load_sample_data(db_service)
        return {"message": "Sample data loaded successfully", "status": "success"}
    except Exception as e:
        logger.error("Failed to load sample data: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while loading sample data.")


@router.post("/clear")
def clear_database():
    try:
        db_service.clear_database()
        return {"message": "Database cleared successfully", "status": "success"}
    except Exception as e:
        logger.error("Failed to clear database: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while clearing the database.")