from fastapi import APIRouter, Query
from typing import List, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.database import db_service
from app.services.network_analysis import network_service
from app.models.schemas import DashboardStats, EntityResponse, NetworkAnalysis

router = APIRouter(prefix="/api", tags=["analysis"])


def entity_to_response(entity: dict) -> EntityResponse:
    return EntityResponse(
        id=entity.get("id", ""),
        entity_type=entity.get("entity_type", ""),
        name=entity.get("name", ""),
        properties={k: v for k, v in entity.items() if k not in ("id", "name", "entity_type", "centrality_score", "connection_count")},
        centrality_score=entity.get("centrality_score", 0),
        connection_count=entity.get("connection_count", 0),
    )


def _pattern_members(patterns: List[dict]) -> set:
    members = set()
    for p in patterns:
        for eid in p.get("entities", []) or []:
            members.add(eid)
        for group in p.get("entity_groups", []) or []:
            if isinstance(group, (list, tuple)):
                members.update(group)
            else:
                members.add(group)
        for pair in p.get("pairs", []) or []:
            if isinstance(pair, (list, tuple)):
                members.update(pair)
            else:
                members.add(pair)
    return members


def _build_flagged_reasons(entity_id: str, network: dict, related_cases: List[dict]) -> List[dict]:
    reasons = []
    case_count = len(related_cases)

    if case_count >= 2:
        reasons.append({"text": "Appears in multiple cases", "detail": f"Referenced in {case_count} registered cases"})
    elif case_count == 1:
        fir = (related_cases[0].get("fir_number") or "") if related_cases else ""
        reasons.append({
            "text": "Appears in a registered case",
            "detail": f"Referenced in FIR {fir}" if fir else "Referenced in a crime record",
        })

    degree = network.get("degree", 0)
    if degree >= 6:
        reasons.append({"text": "High number of network connections", "detail": f"Connected to {degree} entities"})

    if network.get("is_hub", False):
        reasons.append({"text": "Acts as a hub node", "detail": f"Connected to {degree} entities"})

    org_n = network.get("organization_count", 0)
    if org_n >= 2:
        reasons.append({"text": "Connected to multiple organizations", "detail": f"Linked to {org_n} organizations"})

    loc_n = network.get("location_count", 0)
    if loc_n >= 2:
        reasons.append({"text": "Connected to multiple locations", "detail": f"Linked to {loc_n} locations"})

    if network.get("is_bridge", False):
        reasons.append({
            "text": "Acts as a bridge between network groups",
            "detail": f"Betweenness centrality {network.get('betweenness', 0):.2f}",
        })

    patterns = network_service.detect_suspicious_patterns()
    for p in patterns:
        if p.get("type") != "triangle_cluster":
            continue
        if entity_id in _pattern_members([p]):
            reasons.append({
                "text": "Member of a tight-knit network group",
                "detail": p.get("description", "Detected triangle cluster"),
            })
            break

    return reasons


@router.get("/dashboard")
def get_dashboard():
    stats = db_service.get_stats()

    # Build network graph for analysis
    entities = db_service.get_all_entities()
    relationships = db_service.get_entity_relationships_only()
    network_service.build_graph(entities, relationships)
    centrality = network_service.calculate_centrality()

    # Update entity centrality scores in DB
    for entity in entities:
        score = centrality.get(entity["id"], 0)
        entity["centrality_score"] = round(score, 4)
        entity["connection_count"] = network_service.graph.degree(entity["id"]) if entity["id"] in network_service.graph else 0

    # Get important entities
    important_ids = network_service.find_high_risk_entities(centrality, top_n=10)
    important_entities = [entity_to_response(e) for e in entities if e["id"] in important_ids]

    # Get suspicious patterns
    patterns = network_service.detect_suspicious_patterns()

    # Get top connected entities
    degree_scores = network_service.get_degree_scores()
    top_connected_ids = sorted(degree_scores, key=degree_scores.get, reverse=True)[:10]
    top_connected = []
    for eid in top_connected_ids:
        ent = next((e for e in entities if e["id"] == eid), None)
        if ent:
            resp = entity_to_response(ent)
            resp.connection_count = degree_scores.get(eid, 0)
            top_connected.append(resp)

    # Get recent cases with extracted entities
    recent_cases_raw = db_service.get_all_crime_records()[:5]
    recent_cases = []
    for rc_raw in recent_cases_raw:
        rc = {k: str(v) if not isinstance(v, (str, int, float, bool, type(None))) else v for k, v in rc_raw.items()}
        case_entities = db_service.get_crime_entities(rc["id"])
        rc["extracted_entities"] = [
            {"id": str(e.get("id", "")), "entity_type": str(e.get("entity_type", "")), "name": str(e.get("name", ""))}
            for e in case_entities
        ]
        recent_cases.append(rc)

    # Entity type breakdown
    entity_breakdown = {
        "persons": stats.get("total_persons", 0),
        "organizations": stats.get("total_organizations", 0),
        "vehicles": stats.get("total_vehicles", 0),
        "phones": stats.get("total_phones", 0),
        "locations": stats.get("total_locations", 0),
    }

    return {
        "total_cases": stats.get("total_cases", 0),
        "total_persons": stats.get("total_persons", 0),
        "total_organizations": stats.get("total_organizations", 0),
        "total_relationships": stats.get("total_relationships", 0),
        "total_entity_relationships": stats.get("total_entity_relationships", 0),
        "total_vehicles": stats.get("total_vehicles", 0),
        "total_phones": stats.get("total_phones", 0),
        "total_locations": stats.get("total_locations", 0),
        "total_entities": stats.get("total_entities", 0),
        "entity_breakdown": entity_breakdown,
        "relationship_types": stats.get("relationship_types", []),
        "important_entities": important_entities,
        "top_connected": top_connected,
        "recent_cases": recent_cases,
        "suspicious_patterns": patterns,
    }


@router.get("/network")
def get_network():
    entities = db_service.get_all_entities()
    relationships = db_service.get_entity_relationships_only()

    network_service.build_graph(entities, relationships)
    centrality = network_service.calculate_centrality()
    communities = network_service.detect_communities()
    high_risk_ids = network_service.find_high_risk_entities(centrality, top_n=10)
    patterns = network_service.detect_suspicious_patterns()

    entity_responses = []
    for e in entities:
        resp = entity_to_response(e)
        resp.centrality_score = round(centrality.get(e["id"], 0), 4)
        resp.connection_count = network_service.graph.degree(e["id"]) if e["id"] in network_service.graph else 0
        entity_responses.append(resp)

    rel_responses = []
    for r in relationships:
        rel_responses.append({
            "id": r.get("id", ""),
            "source": r.get("source", ""),
            "target": r.get("target", ""),
            "relationship_type": r.get("relationship_type", ""),
            "properties": {},
        })

    return {
        "entities": [e.dict() for e in entity_responses],
        "relationships": rel_responses,
        "clusters": communities,
        "high_risk_entities": [entity_to_response(e).dict() for e in entities if e["id"] in high_risk_ids],
        "patterns": patterns,
    }


@router.get("/search")
def search_entities(q: str = Query(..., min_length=1)):
    entities = db_service.search_entities(q)
    rels = []
    for e in entities:
        connected = db_service.get_connected_entities(e["id"])
        for c in connected:
            ce = c["entity"]
            rels.append({
                "id": "",
                "source": e["id"],
                "target": ce["id"],
                "relationship_type": c["rel_type"],
                "properties": {},
            })

    # Deduplicate relationships
    seen = set()
    unique_rels = []
    for r in rels:
        key = (r["source"], r["target"], r["relationship_type"])
        if key not in seen:
            seen.add(key)
            unique_rels.append(r)

    return {
        "entities": [entity_to_response(e).dict() for e in entities],
        "relationships": unique_rels,
    }


@router.get("/investigation/{entity_id}")
def get_investigation(entity_id: str):
    entity = db_service.get_entity(entity_id)
    if not entity:
        return {"error": "Entity not found"}

    connected = db_service.get_connected_entities(entity_id)

    connected_people = []
    phones = []
    vehicles = []
    locations = []
    organizations = []

    for item in connected:
        e = item["entity"]
        etype = e.get("entity_type", "")
        resp = entity_to_response(e).dict()
        resp["rel_type"] = item.get("rel_type", "")
        if etype == "Person":
            connected_people.append(resp)
        elif etype == "Phone":
            phones.append(resp)
        elif etype == "Vehicle":
            vehicles.append(resp)
        elif etype == "Location":
            locations.append(resp)
        elif etype == "Organization":
            organizations.append(resp)

    related_cases = db_service.get_entity_related_cases(entity_id)

    # Build network for analysis
    all_entities = db_service.get_all_entities()
    all_rels = db_service.get_entity_relationships_only()
    network_service.build_graph(all_entities, all_rels)

    network_analysis = network_service.get_entity_network_analysis(entity_id)
    review_score = network_service.calculate_review_score(entity_id, related_case_count=len(related_cases))
    flagged_reasons = _build_flagged_reasons(entity_id, network_analysis, related_cases)

    return {
        "entity": entity_to_response(entity).dict(),
        "connected_people": connected_people,
        "phones": phones,
        "vehicles": vehicles,
        "locations": locations,
        "organizations": organizations,
        "related_cases": related_cases,
        "relationships": [
            {
                "source": item["entity"].get("id"),
                "target": entity_id,
                "relationship_type": item["rel_type"],
            }
            for item in connected
        ],
        "risk_score": review_score,
        "analysis": {
            "overview": {
                "name": entity.get("name", ""),
                "entity_type": entity.get("entity_type", ""),
                "connection_count": network_analysis.get("degree", 0),
                "related_case_count": len(related_cases),
                "organization_count": network_analysis.get("organization_count", 0),
                "location_count": network_analysis.get("location_count", 0),
                "phone_count": network_analysis.get("phone_count", 0),
                "vehicle_count": network_analysis.get("vehicle_count", 0),
            },
            "network": network_analysis,
            "flagged_reasons": flagged_reasons,
            "review_score": review_score,
        },
    }


@router.get("/path")
def find_path_between(source_id: str = Query(...), target_id: str = Query(...)):
    paths = db_service.find_path(source_id, target_id)
    if not paths:
        return {"paths": [], "message": "No path found between entities"}

    result = []
    for p in paths:
        result.append({
            "nodes": p.get("nodes", []),
            "length": p.get("path_length", 0),
        })
    return {"paths": result}
