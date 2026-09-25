from fastapi import APIRouter, Depends
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.models.schemas import NaturalSearchRequest
from app.dependencies import get_current_user, require_roles, ANY_AUTH_ROLE
from app.services import natural_search
from app.services.database import db_service

router = APIRouter(
    prefix="/api/investigation",
    tags=["natural-search"],
    dependencies=[Depends(get_current_user), Depends(require_roles(*ANY_AUTH_ROLE))],
)


@router.post("/natural-search")
def natural_search_endpoint(data: NaturalSearchRequest):
    """Interpret a natural-language investigation request and run it against the graph.

    Parsing is rule-based and deterministic. The raw text is never executed as
    Cypher — only whitelisted intent structures produce parameterized queries.
    Every authenticated role (admin, investigator, analyst) may read.
    """
    try:
        parsed = natural_search.parse(data.query)
    except natural_search.UnsupportedQueryError:
        return {
            "status": "unsupported",
            "original_query": data.query,
            "interpreted_query": None,
            "interpretation": None,
            "intent": None,
            "message": natural_search.UNSUPPORTED_MESSAGE,
            "target": None,
            "candidates": [],
            "results": [],
            "result_count": 0,
            "graph": {"entities": [], "relationships": []},
            "example_queries": natural_search.SUPPORTED_EXAMPLES,
        }

    enveloped = natural_search.run(db_service, parsed, resolve_entity_id=data.entity_id)
    interpretation = natural_search.describe(parsed, _resolved_for_describe(enveloped))

    response = {
        "original_query": data.query,
        "interpreted_query": interpretation.get("summary"),
        "interpretation": interpretation,
        "intent": parsed,
        "status": enveloped.get("status", "ok"),
        "message": enveloped.get("message"),
        "target": enveloped.get("target"),
        "candidates": enveloped.get("candidates", []),
        "results": enveloped.get("results", []),
        "result_count": len(enveloped.get("results", [])),
        "graph": enveloped.get("graph", {"entities": [], "relationships": []}),
    }
    if response["status"] == "unsupported":
        response["example_queries"] = natural_search.SUPPORTED_EXAMPLES
    return response


def _resolved_for_describe(enveloped: dict):
    """Pass the resolved target into the interpretation description."""
    target = enveloped.get("target")
    if target and isinstance(target, dict) and target.get("kind") != "case":
        return {"entity": target}
    return None