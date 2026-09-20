from fastapi import APIRouter, HTTPException
from typing import List
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.database import db_service
from app.services.nlp_service import nlp_service
from app.services.network_analysis import network_service
from app.models.schemas import CrimeRecord, CrimeRecordResponse

router = APIRouter(prefix="/api/crimes", tags=["crimes"])


def _compute_entity_scores():
    """Compute centrality scores for all entities."""
    entities = db_service.get_all_entities()
    relationships = db_service.get_entity_relationships_only()
    network_service.build_graph(entities, relationships)
    centrality = network_service.calculate_centrality()
    score_map = {}
    for e in entities:
        eid = e["id"]
        score_map[eid] = {
            "centrality_score": round(centrality.get(eid, 0), 4),
            "connection_count": network_service.graph.degree(eid) if eid in network_service.graph else 0,
        }
    return score_map


@router.get("/", response_model=List[CrimeRecordResponse])
def get_crimes():
    records = db_service.get_all_crime_records()
    score_map = _compute_entity_scores()
    result = []
    for r in records:
        entities = db_service.get_crime_entities(r["id"])
        result.append(CrimeRecordResponse(
            id=r["id"],
            fir_number=r.get("fir_number", ""),
            title=r.get("title", ""),
            description=r.get("description", ""),
            date=r.get("date", ""),
            location=r.get("location", ""),
            ipc_sections=r.get("ipc_sections", ""),
            status=r.get("status", "Under Investigation"),
            extracted_entities=[
                {
                    "id": e.get("id", ""),
                    "entity_type": e.get("entity_type", ""),
                    "name": e.get("name", ""),
                    "properties": {},
                    "centrality_score": score_map.get(e.get("id", ""), {}).get("centrality_score", 0),
                    "connection_count": score_map.get(e.get("id", ""), {}).get("connection_count", 0),
                }
                for e in entities
            ]
        ))
    return result


@router.get("/{crime_id}")
def get_crime(crime_id: str):
    record = db_service.get_crime_record(crime_id)
    if not record:
        raise HTTPException(status_code=404, detail="Crime record not found")
    entities = db_service.get_crime_entities(crime_id)
    return {
        **record,
        "entities": [{"id": e.get("id"), "name": e.get("name"), "entity_type": e.get("entity_type")} for e in entities]
    }


@router.post("/", response_model=CrimeRecordResponse)
def create_crime(data: CrimeRecord):
    record = db_service.create_crime_record(data.dict(exclude={"extracted_entities"}))

    # Extract entities using NLP
    text = f"{data.title}. {data.description}"
    extracted = nlp_service.extract_entities(text)

    # Create entities and relationships in the graph
    created_entities = []
    for ent in extracted:
        entity = db_service.find_or_create_entity(ent["entity_type"], ent["name"], {
            "source": "nlp_extracted",
            "fir_number": data.fir_number,
        })
        db_service.link_entity_to_crime(entity["id"], record["id"], "SUSPECTED_IN")
        created_entities.append({
            "id": entity.get("id", ""),
            "entity_type": entity.get("entity_type", ""),
            "name": entity.get("name", ""),
            "properties": {},
            "centrality_score": 0,
            "connection_count": 0,
        })

    # Extract relationships
    relationships = nlp_service.extract_relationships(text, extracted)
    for rel in relationships:
        source = db_service.get_entity_by_name(rel["source"])
        target = db_service.get_entity_by_name(rel["target"])
        if source and target:
            db_service.create_relationship(source["id"], target["id"], rel["relationship_type"], {
                "context": rel.get("context", ""),
            })

    return CrimeRecordResponse(
        id=record["id"],
        fir_number=record.get("fir_number", ""),
        title=record.get("title", ""),
        description=record.get("description", ""),
        date=record.get("date", ""),
        location=record.get("location", ""),
        ipc_sections=record.get("ipc_sections", ""),
        status=record.get("status", "Under Investigation"),
        extracted_entities=created_entities
    )
