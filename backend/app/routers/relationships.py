from fastapi import APIRouter, HTTPException
from typing import List, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.database import db_service
from app.models.schemas import RelationshipCreate

router = APIRouter(prefix="/api/relationships", tags=["relationships"])


@router.get("/")
def get_relationships(entity_id: Optional[str] = None):
    if entity_id:
        rels = db_service.get_relationships(entity_id)
    else:
        rels = db_service.get_relationships()
    return rels


@router.post("/")
def create_relationship(data: RelationshipCreate):
    rel = db_service.create_relationship(
        data.source_id, data.target_id,
        data.relationship_type.value, data.properties
    )
    return rel


@router.get("/connected/{entity_id}")
def get_connected(entity_id: str):
    connected = db_service.get_connected_entities(entity_id)
    return [
        {
            "entity": item["entity"],
            "rel_type": item["rel_type"],
        }
        for item in connected
    ]


@router.get("/path")
def find_path(source_id: str, target_id: str, max_depth: int = 6):
    paths = db_service.find_path(source_id, target_id, max_depth)
    if not paths:
        return {"paths": [], "message": "No path found"}
    result = []
    for p in paths:
        result.append({
            "nodes": p.get("nodes", []),
            "length": p.get("path_length", 0),
        })
    return {"paths": result}
