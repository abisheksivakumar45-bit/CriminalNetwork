import re

from pydantic import BaseModel, Field, field_validator
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
    name: str = Field(..., min_length=1, max_length=200)
    properties: dict = {}

    @field_validator("properties")
    @classmethod
    def _validate_properties(cls, v):
        return validate_properties_map(v)


class EntityResponse(BaseModel):
    id: str
    entity_type: str
    name: str
    properties: dict = {}
    centrality_score: float = 0.0
    connection_count: int = 0


class RelationshipCreate(BaseModel):
    source_id: str = Field(..., min_length=1, max_length=64)
    target_id: str = Field(..., min_length=1, max_length=64)
    relationship_type: RelationshipType
    properties: dict = {}

    @field_validator("properties")
    @classmethod
    def _validate_properties(cls, v):
        return validate_properties_map(v)


class RelationshipResponse(BaseModel):
    id: str
    source: str
    target: str
    relationship_type: str
    properties: dict = {}


class CaseStatus(str, Enum):
    UNDER_INVESTIGATION = "Under Investigation"
    SUSPECT_IDENTIFIED = "Suspect Identified"
    ARREST_MADE = "Arrest Made"
    CHARGES_FILED = "Charges Filed"
    CLOSED = "Closed"


_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_properties_map(v):
    """Cap the size of user-supplied property maps (keys + serialized value length)."""
    if v is None:
        return {}
    if not isinstance(v, dict):
        raise ValueError("properties must be an object")
    if len(v) > 50:
        raise ValueError("properties must not contain more than 50 keys")
    for key, value in v.items():
        if not isinstance(key, str) or len(key) > 64:
            raise ValueError("property keys must be strings of at most 64 characters")
        if value is not None and len(str(value)) > 500:
            raise ValueError("property values must not exceed 500 characters")
    return v


class CrimeRecord(BaseModel):
    fir_number: str = Field("", max_length=64)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=20000)
    date: str = Field("", max_length=10)
    location: str = Field("", max_length=150)
    ipc_sections: str = Field("", max_length=200)
    status: CaseStatus = CaseStatus.UNDER_INVESTIGATION

    @field_validator("title", "description")
    @classmethod
    def _reject_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be blank")
        return v

    @field_validator("date")
    @classmethod
    def _validate_date(cls, v: str) -> str:
        if not v:
            return ""
        if not _DATE_PATTERN.fullmatch(v):
            raise ValueError("must be in YYYY-MM-DD format")
        return v

    @field_validator("fir_number")
    @classmethod
    def _trim_fir_number(cls, v: str) -> str:
        return v.strip()


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


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=8, max_length=256)
    role: str = Field("analyst", description="admin, investigator or analyst")
    display_name: str = Field("", max_length=128)
    email: str = Field("", max_length=254)


class UserResponse(BaseModel):
    username: str
    display_name: str = ""
    email: str = ""
    role: str
    active: bool = True


class AuthSuccessResponse(BaseModel):
    user: UserResponse