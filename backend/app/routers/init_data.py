from fastapi import APIRouter
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.database import db_service
from app.services.sample_data import load_sample_data

router = APIRouter(prefix="/api/init", tags=["init"])


@router.post("/load-sample-data")
def init_sample_data():
    try:
        load_sample_data(db_service)
        return {"message": "Sample data loaded successfully", "status": "success"}
    except Exception as e:
        return {"message": f"Error loading sample data: {str(e)}", "status": "error"}


@router.post("/clear")
def clear_database():
    try:
        db_service.clear_database()
        return {"message": "Database cleared successfully", "status": "success"}
    except Exception as e:
        return {"message": f"Error clearing database: {str(e)}", "status": "error"}
