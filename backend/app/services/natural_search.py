"""Natural Language Investigation Search.

Converts a *controlled* set of English investigation questions into a safe,
structured internal representation, resolves named entities against the
existing Neo4j investigation graph, and executes parameterized Cypher only.

Design rules (see SECURITY_REVIEW / README):
  * Deterministic, rule-based parser — the system is an investigator-assistance
    tool and must be explainable. It does NOT claim to understand unrestricted
    natural language (spaCy is intentionally not used for intent here).
  * The user's free text is NEVER concatenated into Cypher. Only whitelisted
    entity-type labels and structure derived from the parser are used, and all
    values are passed as Cypher parameters.
  * No entity/case is invented: resolution failures return a clear message.
  * Multi-match names produce an ambiguity response with selectable candidates.
"""
import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger("crimenet.natural_search")

# Supported discovery of existing data: phones are stored with a leading "+",
# e.g. "+919876543210". The parser normalizes "9876543210" to this form.
_PHONE_LIKE_MIN_DIGITS = 8

# ── Supported entity types & synonyms ───────────────────────────────────────
# Mapping of user words → internal Entity.entity_type. "entities" means "any".
ENTITY_TYPE_SYNONYMS: Dict[str, Optional[str]] = {
    "person": "Person", "persons": "Person", "people": "Person",
    "individual": "Person", "individuals": "Person",
    "suspect": "Person", "suspects": "Person", "accused": "Person",
    "victim": "Person", "victims": "Person",
    "organization": "Organization", "organizations": "Organization",
    "company": "Organization", "companies": "Organization",
    "firm": "Organization", "firms": "Organization",
    "group": "Organization", "groups": "Organization",
    "syndicate": "Organization", "syndicates": "Organization",
    "phone": "Phone", "phones": "Phone", "number": "Phone", "numbers": "Phone",
    "vehicle": "Vehicle", "vehicles": "Vehicle", "car": "Car", "cars": "Car",
    "location": "Location", "locations": "Location",
    "place": "Location", "places": "Location", "area": "Location", "areas": "Location",
    "entity": None, "entities": None,
}

# User-facing labels for the interpretation panel.
TYPE_LABELS = {
    "Person": "Person",
    "Organization": "Organization",
    "Phone": "Phone",
    "Vehicle": "Vehicle",
    "Location": "Location",
    "Car": "Vehicle",
}

_CANONICAL_TYPE = {"Car": "Vehicle"}

_TYPE_ALT = "|".join(
    sorted(ENTITY_TYPE_SYNONYMS, key=len, reverse=True)
)
_TYPE_CLAUSE = rf"(?:the\s+)?(?:all\s+)?({_TYPE_ALT})"

# Verbs that begin a supported investigation request.
_VERB = r"(?:please\s+)?(?:show|find|get|list|display|return|give)\s+(?:me\s+)?"

_WORD_NUMBERS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
}

# Maximum result rows returned per execution (scoped queries only).
MAX_RESULTS = 50

SUPPORTED_EXAMPLES = [
    "Show all entities connected to Rajesh Kumar.",
    "Show people connected to Rajesh Kumar through organizations.",
    "Show organizations connected to Rajesh Kumar.",
    "Show people connected to phone 9876543210.",
    "Find entities appearing in more than two cases.",
    "Show cases involving Rajesh Kumar.",
    "Show entities connected to entities in case FIR-2024-001.",
]

UNSUPPORTED_MESSAGE = (
    "I couldn't interpret that investigation query yet. "
    "Try one of the supported examples."
)
ENTITY_NOT_FOUND_MESSAGE = "No matching entity was found for '{name}'."
CASE_NOT_FOUND_MESSAGE = "No matching case was found for '{fir}'."
AMBIGUOUS_ENTITY_MESSAGE = (
    "Multiple matching entities were found. Please select the intended entity."
)
EMPTY_RESULTS_MESSAGE = "No matching investigation results were found."


class UnsupportedQueryError(Exception):
    """Raised when no controlled pattern matches the free-text query."""


# ── Compiled intent patterns (order matters; checked first → last) ──────────
_FIR_TOKEN = r"[A-Za-z0-9][A-Za-z0-9\- ]*"
_FIR_TAIL = r"(?:(?:the\s+)?case\s+)?(?P<fir>FIR\s?[A-Za-z0-9\-]+)"

_ENTITIES_IN_CASE_RE_1 = re.compile(
    rf"^{_VERB}(?:all\s+)?entities?\s+connected\s+to\s+entities?\s+in\s+{_FIR_TAIL}[.!?]\s*$",
    re.IGNORECASE,
)
_ENTITIES_IN_CASE_RE_2 = re.compile(
    rf"^{_VERB}(?:all\s+)?entities?\s+(?:appearing\s+in\s+|in\s+)?(?:the\s+)?(?:case\s+)?(FIR\s?[A-Za-z0-9\-]+)[.!?]\s*$",
    re.IGNORECASE,
)
_CASE_FREQUENCY_RE = re.compile(
    rf"^{_VERB}(?:all\s+)?entities?\s+appearing\s+in\s+"
    r"(?P<conn>(?:more than|at least|over)\s+)?(?P<num>\d+|[a-z]+)(?:\s+or\s+more)?\s*cases?[.!?]\s*$",
    re.IGNORECASE,
)
_CASES_INVOLVING_RE = re.compile(
    rf"^{_VERB}(?:all\s+)?cases?\s+(?:involving|related\s+to|associated\s+with|connected\s+to)\s+(?P<target>.+?)[.!?]\s*$",
    re.IGNORECASE,
)
_CONNECTED_RE = re.compile(
    rf"^{_VERB}(?P<type>{_TYPE_CLAUSE})\s+connected\s+to\s+(?P<target>.*?)(?:\s+through\s+(?P<via>{_TYPE_CLAUSE}))?[.!?]\s*$",
    re.IGNORECASE,
)


# ── Helpers ─────────────────────────────────────────────────────────────────
def _parse_number(token: str) -> Optional[int]:
    token = (token or "").strip()
    if token.isdigit():
        n = int(token)
        return n if 1 <= n <= 1000 else None
    return _WORD_NUMBERS.get(token.lower())


def _normalize_phone_name(name: str) -> str:
    """Return the canonical stored phone format (+91...) when plausible."""
    digits = re.sub(r"\D", "", name)
    if not digits:
        return ""
    if len(digits) == 10:
        return "+91" + digits
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    if len(digits) == 11 and digits.startswith("0"):
        return "+91" + digits[1:]
    return name


def _is_phone_like(name: str) -> bool:
    digits = re.sub(r"\D", "", name)
    return len(digits) >= _PHONE_LIKE_MIN_DIGITS


def _strip_leading_type_word(text: str) -> str:
    """Drop a leading entity-type word when it is only a qualifier.

    E.g. "people connected to phone 9876543210" targets "phone 9876543210";
    the leading "phone" is a qualifier, not part of the entity name.
    """
    text = text.strip()
    parts = text.split(None, 1)
    if len(parts) == 2 and parts[0].lower() in ENTITY_TYPE_SYNONYMS:
        reminder = parts[1].strip()
        if reminder:
            return reminder
    return text


def _clean_name(name: str) -> str:
    name = re.sub(r"^[\"'`\u2018\u2019\u201c\u201d]+|[\"'`\u2018\u2019\u201c\u201d]+$", "", name or "")
    return name.strip()


def _parse_type_token(token: str) -> Optional[str]:
    etype = ENTITY_TYPE_SYNONYMS.get((token or "").strip().lower())
    return _CANONICAL_TYPE.get(etype, etype)


# ── Parser ──────────────────────────────────────────────────────────────────
def parse(query: str) -> Dict[str, Any]:
    """Parse a controlled English investigation query into an intent dict.

    Raises UnsupportedQueryError when no supported pattern matches.
    """
    q = (query or "").strip()
    if not q:
        raise UnsupportedQueryError("empty query")

    # 1) Find entities connected to entities in a given case (FIR).
    m = _ENTITIES_IN_CASE_RE_1.match(q)
    if m:
        return {
            "operation": "entities_in_case",
            "case_ref": _clean_name(m.group("fir")),
        }
    m = _ENTITIES_IN_CASE_RE_2.match(q)
    if m:
        return {
            "operation": "entities_in_case",
            "case_ref": _clean_name(m.group(1)),
        }

    # 2) Case frequency (entities appearing in > N cases).
    m = _CASE_FREQUENCY_RE.match(q)
    if m:
        threshold = _parse_number(m.group("num"))
        if threshold is None:
            raise UnsupportedQueryError("unparseable threshold")
        connector = (m.group("conn") or "").strip().lower()
        condition = "gt" if connector in ("more than", "over") else None
        condition = condition or ("gte" if connector in ("at least",) else "gte")
        return {
            "operation": "case_frequency",
            "threshold": threshold,
            "condition": condition,  # gt => count > threshold, gte => count >= threshold
        }

    # 3) Cases involving / related to an entity.
    m = _CASES_INVOLVING_RE.match(q)
    if m:
        return {
            "operation": "cases_involving",
            "target_entity": _clean_name(m.group("target")),
        }

    # 4) Connected entities (direct, type-filtered, or through a type).
    m = _CONNECTED_RE.match(q)
    if m:
        target = _clean_name(m.group("target"))
        target = _strip_leading_type_word(target)
        if not target:
            raise UnsupportedQueryError("missing target entity")
        type_token = m.groupdict().get("type") or "entities"
        ttype = _parse_type_token(type_token) if isinstance(type_token, str) else None
        via = None
        via_token = m.groupdict().get("via")
        if via_token:
            via = _parse_type_token(via_token)
            if via is None:
                raise UnsupportedQueryError("unsupported 'through' type")
        return {
            "operation": "connected_entities",
            "target_entity": target,
            "target_type": ttype,
            "via_type": via,
        }

    raise UnsupportedQueryError("no supported pattern matched")


def describe(intent: Dict[str, Any], resolved_target: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Human- and machine-readable interpretation for the response panel."""
    op = intent["operation"]
    base = {"operation": op}

    if op == "connected_entities":
        start_type = ((resolved_target or {}).get("entity") or {}).get("entity_type") or "Entity"
        path: List[str] = [start_type]
        if intent.get("via_type"):
            path.append(TYPE_LABELS.get(intent["via_type"], intent["via_type"]))
        path.append(TYPE_LABELS.get(intent["target_type"], intent["target_type"]) if intent.get("target_type") else "Any entity")
        base.update({
            "target_entity": intent.get("target_entity"),
            "target_type": intent.get("target_type"),
            "via_type": intent.get("via_type"),
            "path": path,
            "summary": "Connected entities",
        })
    elif op == "case_frequency":
        rel = "more than" if intent["condition"] == "gt" else "at least"
        base.update({
            "threshold": intent["threshold"],
            "condition": intent["condition"],
            "summary": f"Entities appearing in {rel} {intent['threshold']} cases",
        })
    elif op == "cases_involving":
        base.update({
            "target_entity": intent.get("target_entity"),
            "summary": f"Cases involving {intent.get('target_entity')}",
        })
    elif op == "entities_in_case":
        base.update({
            "case_ref": intent.get("case_ref"),
            "summary": f"Entities linked to case {intent.get('case_ref')}",
        })
    return base


# ── Entity & case resolution ────────────────────────────────────────────────
def _select_candidate(candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Pure decision step: resolved / ambiguous / none.

    Kept separate from DB access so the ambiguity behaviour can be unit-tested
    without mutating the Neo4j graph.
    """
    if not candidates:
        return {"status": "none"}
    if len(candidates) == 1:
        return {"status": "resolved", "entity": dict(candidates[0])}
    return {
        "status": "ambiguous",
        "candidates": [dict(c) for c in candidates[:10]],
    }


def _entity_public(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id", ""),
        "name": row.get("name", ""),
        "entity_type": row.get("entity_type", ""),
        "centrality_score": row.get("centrality_score", row.get("cs", 0)),
        "connection_count": row.get("connection_count", row.get("cc", 0)),
    }


def resolve_entity(db, raw_name: str, entity_id: Optional[str] = None) -> Dict[str, Any]:
    """Resolve a user-named entity against the existing graph.

    Priority: exact id (disambiguation) → case-insensitive exact name →
    normalized phone match → case-insensitive substring match. Returns
    {status: resolved|ambiguous|none, ...}.
    """
    name = _clean_name(raw_name or "")
    if not name and not entity_id:
        return {"status": "none"}

    if entity_id:
        rows = db._run_query(
            "MATCH (n:Entity {id: $id}) RETURN n.id as id, n.name as name, "
            "n.entity_type as entity_type, n.centrality_score as cs, n.connection_count as cc LIMIT 1",
            {"id": entity_id},
        )
        return _select_candidate([_entity_public(r) for r in rows])

    candidates = []
    if name:
        rows = db._run_query(
            "MATCH (n:Entity) WHERE toLower(n.name) = toLower($name) "
            "RETURN n.id as id, n.name as name, n.entity_type as entity_type, "
            "n.centrality_score as cs, n.connection_count as cc LIMIT 20",
            {"name": name},
        )
        candidates = [_entity_public(r) for r in rows]

    if not candidates and _is_phone_like(name):
        digits = re.sub(r"\D", "", name)
        if len(digits) == 10 and not digits.startswith("91"):
            digits = "91" + digits
        rows = db._run_query(
            "MATCH (n:Entity {entity_type: 'Phone'}) WHERE replace(n.name, '+', '') = $digits "
            "RETURN n.id as id, n.name as name, n.entity_type as entity_type, "
            "n.centrality_score as cs, n.connection_count as cc LIMIT 20",
            {"digits": digits},
        )
        candidates = [_entity_public(r) for r in rows]

    if not candidates and name and len(name) >= 3:
        rows = db._run_query(
            "MATCH (n:Entity) WHERE toLower(n.name) CONTAINS toLower($tok) "
            "RETURN n.id as id, n.name as name, n.entity_type as entity_type, "
            "n.centrality_score as cs, n.connection_count as cc LIMIT 20",
            {"tok": name},
        )
        candidates = [_entity_public(r) for r in rows]

    return _select_candidate(candidates)


def _normalize_fir(ref: str) -> str:
    text = re.sub(r"^\s*(?:the\s+)?case\s+", "", (ref or "").strip(), flags=re.IGNORECASE)
    return re.sub(r"[\s\-]", "", text.upper())


def resolve_case(db, fir_ref: str) -> Dict[str, Any]:
    """Resolve a FIR/case reference against existing CrimeRecord nodes."""
    ref = _clean_name(fir_ref or "")
    ref = re.sub(r"^\s*(?:the\s+)?case\s+", "", ref, flags=re.IGNORECASE).strip()
    if not ref:
        return {"status": "none"}
    rows = db._run_query(
        "MATCH (c:CrimeRecord) WHERE toLower(c.fir_number) = toLower($ref) "
        "RETURN c.id as id, c.fir_number as fir_number, c.title as title, "
        "c.date as date, c.location as location, c.status as status LIMIT 10",
        {"ref": ref},
    )
    candidates = [dict(r) for r in rows]
    if not candidates:
        # Normalized (no spaces/dashes) comparison against the small case store.
        all_cases = db._run_query(
            "MATCH (c:CrimeRecord) RETURN c.id as id, c.fir_number as fir_number, "
            "c.title as title, c.date as date, c.location as location, c.status as status"
        )
        target = _normalize_fir(ref)
        candidates = [dict(r) for r in all_cases if _normalize_fir(r.get("fir_number", "")) == target]
    return _select_candidate([{"id": r["id"], "name": r.get("fir_number", ""), **r} for r in candidates])


# ── Executors (parameterized Cypher only) ───────────────────────────────────
def _collect_case_counts(db, entity_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    if not entity_ids:
        return {}
    rows = db._run_query(
        "MATCH (e:Entity)-[r]-(c:CrimeRecord) WHERE e.id IN $ids "
        "RETURN e.id as id, count(DISTINCT c) as cnt, collect(DISTINCT c.fir_number)[0..6] as firs",
        {"ids": entity_ids},
    )
    return {r["id"]: {"related_case_count": r.get("cnt", 0), "case_ids": r.get("firs", [])} for r in rows}


def execute_connected(db, parsed: Dict[str, Any], resolved: Dict[str, Any]) -> Dict[str, Any]:
    target = resolved["entity"]
    start_id = target["id"]
    via = parsed.get("via_type")
    tfilter = parsed.get("target_type")

    if via:
        rows = db._run_query(
            "MATCH (s:Entity {id: $sid})-[r1]-(m:Entity {entity_type: $via})-[r2]-(t:Entity) "
            "WHERE t.id <> $sid AND t.id <> m.id AND m.id <> $sid AND ($tt IS NULL OR t.entity_type = $tt) "
            "RETURN t.id as id, t.name as name, t.entity_type as entity_type, "
            "t.centrality_score as cs, t.connection_count as cc, "
            "type(r1) as rel1, type(r2) as rel2, m.id as mid, m.name as mname, m.entity_type as mtype "
            "ORDER BY t.centrality_score DESC LIMIT 50",
            {"sid": start_id, "via": via, "tt": tfilter},
        )
    elif tfilter:
        rows = db._run_query(
            "MATCH (s:Entity {id: $sid})-[r]-(t:Entity {entity_type: $tt}) "
            "WHERE t.id <> $sid "
            "RETURN t.id as id, t.name as name, t.entity_type as entity_type, "
            "t.centrality_score as cs, t.connection_count as cc, type(r) as rel "
            "ORDER BY t.centrality_score DESC LIMIT 50",
            {"sid": start_id, "tt": tfilter},
        )
    else:
        rows = db._run_query(
            "MATCH (s:Entity {id: $sid})-[r]-(t:Entity) "
            "WHERE t.id <> $sid "
            "RETURN t.id as id, t.name as name, t.entity_type as entity_type, "
            "t.centrality_score as cs, t.connection_count as cc, type(r) as rel "
            "ORDER BY t.centrality_score DESC LIMIT 60",
            {"sid": start_id},
        )

    counts = _collect_case_counts(db, [r["id"] for r in rows])
    results = []
    graph_links = []

    for r in rows:
        if via:
            mid = r.get("mid")
            results.append({
                "kind": "entity",
                "id": r["id"],
                "name": r["name"],
                "entity_type": r["entity_type"],
                "relationship_type": r.get("rel2", ""),
                "via": {
                    "id": mid,
                    "name": r.get("mname", ""),
                    "entity_type": r.get("mtype", ""),
                    "to_via": r.get("rel1", ""),
                    "from_via": r.get("rel2", ""),
                },
                "path": [
                    {"id": start_id, "name": target["name"], "entity_type": target["entity_type"], "role": "start"},
                    {"id": mid, "name": r.get("mname", ""), "entity_type": r.get("mtype", ""), "role": "via"},
                    {"id": r["id"], "name": r["name"], "entity_type": r["entity_type"], "role": "end"},
                ],
                **counts.get(r["id"], {"related_case_count": 0, "case_ids": []}),
            })
            graph_links.append({"source": start_id, "target": mid, "relationship_type": r.get("rel1", "")})
            graph_links.append({"source": mid, "target": r["id"], "relationship_type": r.get("rel2", "")})
        else:
            results.append({
                "kind": "entity",
                "id": r["id"],
                "name": r["name"],
                "entity_type": r["entity_type"],
                "relationship_type": r.get("rel", ""),
                "path": [
                    {"id": start_id, "name": target["name"], "entity_type": target["entity_type"], "role": "start"},
                    {"id": r["id"], "name": r["name"], "entity_type": r["entity_type"], "role": "end"},
                ],
                **counts.get(r["id"], {"related_case_count": 0, "case_ids": []}),
            })
            graph_links.append({"source": start_id, "target": r["id"], "relationship_type": r.get("rel", "")})

    # Resolve graph node metas for via nodes.
    node_meta = {start_id: target}
    via_ids = [r.get("mid") for r in rows if via and r.get("mid")]
    if via_ids:
        via_rows = db._run_query(
            "MATCH (m:Entity) WHERE m.id IN $ids RETURN m.id as id, m.name as name, m.entity_type as entity_type "
            "LIMIT 50",
            {"ids": [i for i in dict.fromkeys(via_ids)]},
        )
        for v in via_rows:
            node_meta[v["id"]] = {"id": v["id"], "name": v["name"], "entity_type": v["entity_type"]}
    for r in rows:
        node_meta[r["id"]] = {
            "id": r["id"], "name": r["name"], "entity_type": r["entity_type"],
            "centrality_score": r.get("cs", 0), "connection_count": r.get("cc", 0),
        }

    graph = {
        "entities": [node_meta[i] for i in dict.fromkeys(list(node_meta))],
        "relationships": [{"id": "", "source": l["source"], "target": l["target"], "relationship_type": l["relationship_type"]} for l in graph_links],
    }
    return {"results": results, "graph": graph}


def execute_case_frequency(db, parsed: Dict[str, Any]) -> Dict[str, Any]:
    threshold = parsed["threshold"]
    op = ">" if parsed["condition"] == "gt" else ">="
    rows = db._run_query(
        "MATCH (e:Entity)-[r]-(c:CrimeRecord) "
        "WITH e, count(DISTINCT c) AS cnt, collect(DISTINCT c.fir_number)[0..8] AS firs "
        f"WHERE cnt {op} $threshold "
        "RETURN e.id as id, e.name as name, e.entity_type as entity_type, cnt, firs "
        "ORDER BY cnt DESC LIMIT 50",
        {"threshold": threshold},
    )
    results = [
        {
            "kind": "entity",
            "id": r["id"],
            "name": r["name"],
            "entity_type": r["entity_type"],
            "related_case_count": r.get("cnt", 0),
            "case_ids": r.get("firs", []),
            "path": [
                {"id": r["id"], "name": r["name"], "entity_type": r["entity_type"], "role": "end"},
            ],
        }
        for r in rows
    ]
    graph = {
        "entities": [{"id": r["id"], "name": r["name"], "entity_type": r["entity_type"], "centrality_score": 0, "connection_count": r.get("cnt", 0)} for r in rows],
        "relationships": [],
    }
    return {"results": results, "graph": graph}


def execute_cases_involving(db, resolved: Dict[str, Any]) -> Dict[str, Any]:
    target = resolved["entity"]
    case_rows = db.get_entity_related_cases(target["id"])
    results = []
    for c in case_rows:
        results.append({
            "kind": "case",
            "id": c.get("id"),
            "fir_number": c.get("fir_number", ""),
            "title": c.get("title", ""),
            "status": c.get("status", ""),
            "date": c.get("date", ""),
            "location": c.get("location", ""),
            "relationship_type": c.get("rel_type", ""),
            "entities": [
                {
                    "id": e.get("id"),
                    "name": e.get("name"),
                    "entity_type": e.get("entity_type"),
                    "relationship_type": e.get("rel_type", ""),
                }
                for e in db.get_crime_entities(c["id"])
            ],
        })
    graph = {
        "entities": [{"id": target["id"], "name": target["name"], "entity_type": target["entity_type"], "centrality_score": 0, "connection_count": 0}],
        "relationships": [],
    }
    for c in results:
        graph["entities"].append({"id": c["id"], "name": c["fir_number"], "entity_type": "Case", "centrality_score": 0, "connection_count": 0})
        graph["relationships"].append({"id": "", "source": target["id"], "target": c["id"], "relationship_type": c["relationship_type"]})
    return {"results": results, "graph": graph}


def execute_entities_in_case(db, resolved_case: Dict[str, Any]) -> Dict[str, Any]:
    case = resolved_case["entity"]
    case_id = case["id"]
    rows = db.get_crime_entities(case_id)
    fir = case.get("name", "") or case.get("fir_number", "")
    results = [
        {
            "kind": "entity",
            "id": r.get("id"),
            "name": r.get("name"),
            "entity_type": r.get("entity_type"),
            "relationship_type": r.get("rel_type", ""),
            "related_case_count": 1,
            "case_ids": [fir],
            "path": [
                {"id": case_id, "name": fir, "role": "start"},
                {"id": r.get("id"), "name": r.get("name"), "entity_type": r.get("entity_type"), "role": "end"},
            ],
        }
        for r in rows
    ]
    graph = {
        "entities": [{"id": case_id, "name": fir, "entity_type": "Case", "centrality_score": 0, "connection_count": 0}],
        "relationships": [],
    }
    for r in results:
        graph["entities"].append({"id": r["id"], "name": r["name"], "entity_type": r["entity_type"], "centrality_score": 0, "connection_count": 0})
        graph["relationships"].append({"id": "", "source": case_id, "target": r["id"], "relationship_type": r["relationship_type"]})
    return {"results": results, "graph": graph}


def run(db, parsed: Dict[str, Any], resolve_entity_id: Optional[str] = None) -> Dict[str, Any]:
    """Execute an intent dict against the graph, returning an envelope with a
    bottom-level `status`: ok | empty | not_found | ambiguous | unsupported."""
    op = parsed["operation"]

    if op in ("connected_entities", "cases_involving"):
        resolved = resolve_entity(db, parsed.get("target_entity", ""), resolve_entity_id)
        if resolved["status"] == "none":
            return {"status": "not_found", "message": ENTITY_NOT_FOUND_MESSAGE.format(name=parsed.get("target_entity", ""))}
        if resolved["status"] == "ambiguous":
            return {
                "status": "ambiguous",
                "message": AMBIGUOUS_ENTITY_MESSAGE,
                "candidates": resolved["candidates"],
            }
        if op == "cases_involving":
            out = execute_cases_involving(db, resolved)
        else:
            out = execute_connected(db, parsed, resolved)
        return {
            "status": "ok" if out["results"] else "empty",
            "message": None if out["results"] else EMPTY_RESULTS_MESSAGE,
            "target": resolved["entity"],
            "results": out["results"],
            "graph": out["graph"],
        }

    if op == "entities_in_case":
        resolved = resolve_case(db, parsed.get("case_ref", ""))
        if resolved["status"] == "none":
            return {"status": "not_found", "message": CASE_NOT_FOUND_MESSAGE.format(fir=parsed.get("case_ref", ""))}
        if resolved["status"] == "ambiguous":
            return {
                "status": "ambiguous",
                "message": "Multiple matching cases were found. Please select the intended case.",
                "candidates": resolved["candidates"],
            }
        out = execute_entities_in_case(db, resolved)
        return {
            "status": "ok" if out["results"] else "empty",
            "message": None if out["results"] else EMPTY_RESULTS_MESSAGE,
            "target": {"id": resolved["entity"]["id"], "name": resolved["entity"].get("name", ""), "fir_number": resolved["entity"].get("fir_number", ""), "kind": "case"},
            "results": out["results"],
            "graph": out["graph"],
        }

    if op == "case_frequency":
        out = execute_case_frequency(db, parsed)
        return {
            "status": "ok" if out["results"] else "empty",
            "message": None if out["results"] else EMPTY_RESULTS_MESSAGE,
            "target": None,
            "results": out["results"],
            "graph": out["graph"],
        }

    return {"status": "unsupported", "message": UNSUPPORTED_MESSAGE}