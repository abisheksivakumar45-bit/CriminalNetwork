from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class EntityType(str, Enum):
    PERSON = "Person"
    PHONE = "Phone"
    VEHICLE = "Vehicle"
    LOCATION = "Location"
    ORGANIZATION = "Organization"
    CASE = "Case"


class RelationshipType(str, Enum):
    OWNS = "OWNS"
    USES = "USES"
    LOCATED_AT = "LOCATED_AT"
    MEMBER_OF = "MEMBER_OF"
    SUSPECTED_IN = "SUSPECTED_IN"
    VICTIM_IN = "VICTIM_IN"
    ASSOCIATED_WITH = "ASSOCIATED_WITH"
    CONTACTED = "CONTACTED"
    TRAVELED_WITH = "TRAVELED_WITH"
    FUNDED_BY = "FUNDED_BY"


class EntityCreate(BaseModel):
    entity_type: EntityType
    name: str
    properties: dict = {}


class EntityResponse(BaseModel):
    id: str
    entity_type: str
    name: str
    properties: dict = {}
    centrality_score: float = 0.0
    connection_count: int = 0


class RelationshipCreate(BaseModel):
    source_id: str
    target_id: str
    relationship_type: RelationshipType
    properties: dict = {}


class RelationshipResponse(BaseModel):
    id: str
    source: str
    target: str
    relationship_type: str
    properties: dict = {}


class CrimeRecord(BaseModel):
    fir_number: str = ""
    title: str
    description: str
    date: str = ""
    location: str = ""
    ipc_sections: str = ""
    status: str = "Under Investigation"


class CrimeRecordResponse(BaseModel):
    id: str
    fir_number: str
    title: str
    description: str
    date: str
    location: str
    ipc_sections: str
    status: str
    extracted_entities: List[EntityResponse] = []


class InvestigationView(BaseModel):
    entity: EntityResponse
    connected_people: List[EntityResponse] = []
    phones: List[EntityResponse] = []
    vehicles: List[EntityResponse] = []
    locations: List[EntityResponse] = []
    organizations: List[EntityResponse] = []
    related_cases: List[EntityResponse] = []
    relationships: List[RelationshipResponse] = []


class NetworkAnalysis(BaseModel):
    entities: List[EntityResponse]
    relationships: List[RelationshipResponse]
    clusters: List[List[str]] = []
    high_risk_entities: List[EntityResponse] = []
    patterns: List[dict] = []


class SearchResult(BaseModel):
    entities: List[EntityResponse]
    relationships: List[RelationshipResponse]


class DashboardStats(BaseModel):
    total_cases: int = 0
    total_persons: int = 0
    total_organizations: int = 0
    total_relationships: int = 0
    total_vehicles: int = 0
    total_phones: int = 0
    total_locations: int = 0
    important_entities: List[EntityResponse] = []
    suspicious_patterns: List[dict] = []


class PathResult(BaseModel):
    path: List[dict] = []
    length: int = 0