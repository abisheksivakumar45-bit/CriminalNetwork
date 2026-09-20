from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.database import db_service
from app.models.schemas import EntityCreate, EntityResponse

router = APIRouter(prefix="/api/entities", tags=["entities"])


REL_LABELS = {
    "OWNS": "owns",
    "USES": "uses",
    "LOCATED_AT": "located at",
    "MEMBER_OF": "member of",
    "SUSPECTED_IN": "suspected in",
    "VICTIM_IN": "victim in",
    "ASSOCIATED_WITH": "associated with",
    "CONTACTED": "contacted",
    "TRAVELED_WITH": "traveled with",
    "FUNDED_BY": "funded by",
}

EVENT_CATEGORIES = {
    "Person": "network",
    "Phone": "phones",
    "Vehicle": "vehicles",
    "Location": "locations",
    "Organization": "organizations",
    "Case": "cases",
}

CONNECTION_VERBS = {
    "Person": "connection to",
    "Phone": "phone association with",
    "Vehicle": "vehicle association with",
    "Location": "location association with",
    "Organization": "organization association with",
}


def _normalize_date(value) -> Optional[str]:
    """Parse an existing date value into ISO `YYYY-MM-DD`, or None if invalid/missing."""
    if not value:
        return None
    raw = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%d-%b-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _rel_label(rel_type: str) -> str:
    if not rel_type:
        return "related"
    return REL_LABELS.get(rel_type, rel_type.replace("_", " ").lower())


def entity_to_response(entity: dict) -> EntityResponse:
    return EntityResponse(
        id=entity.get("id", ""),
        entity_type=entity.get("entity_type", ""),
        name=entity.get("name", ""),
        properties={k: v for k, v in entity.items() if k not in ("id", "name", "entity_type", "centrality_score", "connection_count")},
        centrality_score=entity.get("centrality_score", 0),
        connection_count=entity.get("connection_count", 0),
    )


@router.get("/", response_model=List[EntityResponse])
def get_entities(entity_type: Optional[str] = Query(None, description="Filter by entity type")):
    entities = db_service.get_all_entities(entity_type)
    return [entity_to_response(e) for e in entities]


@router.get("/search/{query}")
def search_entities(query: str):
    entities = db_service.search_entities(query)
    return [entity_to_response(e).dict() for e in entities]


@router.get("/{entity_id}/timeline")
def get_entity_timeline(entity_id: str):
    entity = db_service.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    related_cases = db_service.get_entity_related_cases(entity_id)
    connected = db_service.get_connected_entities(entity_id)

    events = []
    seen_cases = set()
    for c in related_cases:
        crime_id = c.get("id")
        if not crime_id or crime_id in seen_cases:
            continue
        seen_cases.add(crime_id)

        rel_type = c.get("rel_type", "")
        fir_number = c.get("fir_number", "")
        title = c.get("title", "")
        label = " - ".join(p for p in (fir_number, title) if p)
        events.append({
            "id": f"case-{crime_id}-{rel_type or 'related'}",
            "date": _normalize_date(c.get("date")),
            "event_type": "Case Appearance",
            "category": "cases",
            "rel_label": _rel_label(rel_type),
            "description": f"Case {label}" if label else "Appears in a case",
            "related_case": {
                "id": crime_id,
                "fir_number": fir_number,
                "title": title,
                "date": c.get("date") or "",
                "location": c.get("location") or "",
            },
            "related_entity": None,
            "location": c.get("location") or None,
        })

    seen_rels = set()
    for item in connected:
        ent = item.get("entity", {})
        eid = ent.get("id")
        rel_type = item.get("rel_type", "")
        key = (eid, rel_type)
        if not eid or key in seen_rels:
            continue
        seen_rels.add(key)

        etype = ent.get("entity_type", "")
        name = ent.get("name", "")
        category = EVENT_CATEGORIES.get(etype, "network")
        verb = CONNECTION_VERBS.get(etype, "connection to")
        events.append({
            "id": f"rel-{eid}-{rel_type or 'linked'}",
            "date": None,
            "event_type": f"{etype} Connection",
            "category": category,
            "rel_label": _rel_label(rel_type),
            "description": f"Recorded {verb} {name}" if name else "Recorded network relationship",
            "related_case": None,
            "related_entity": {
                "id": eid,
                "name": name,
                "entity_type": etype,
            },
            "location": None,
        })

    # Chronological sort: dated events first (oldest -> newest), undated after.
    events.sort(key=lambda e: (1 if e["date"] is None else 0, e["date"] or "", e["event_type"], e["description"]))

    dated = [e["date"] for e in events if e["date"]]
    summary = {
        "total_events": len(events),
        "first_recorded": min(dated) if dated else None,
        "latest_recorded": max(dated) if dated else None,
        "related_cases": len(seen_cases),
    }

    category_counts = {}
    for e in events:
        category_counts[e["category"]] = category_counts.get(e["category"], 0) + 1

    return {
        "entity": {
            "id": entity.get("id", ""),
            "name": entity.get("name", ""),
            "entity_type": entity.get("entity_type", ""),
        },
        "summary": summary,
        "events": events,
        "category_counts": category_counts,
    }


@router.get("/{entity_id}", response_model=EntityResponse)
def get_entity(entity_id: str):
    entity = db_service.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity_to_response(entity)


@router.post("/", response_model=EntityResponse)
def create_entity(data: EntityCreate):
    entity = db_service.create_entity(data.entity_type.value, data.name, data.properties)
    return entity_to_response(entity)


@router.delete("/{entity_id}")
def delete_entity(entity_id: str):
    db_service.delete_entity(entity_id)
    return {"message": "Entity deleted"}
