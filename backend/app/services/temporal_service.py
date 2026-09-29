"""Temporal Network Anomaly Detection.

Deterministic, explainable analysis of *measurable change* in the investigation
graph over time. It only uses dates and relationships already present in the
Neo4j database (CrimeRecord.date is the temporal anchor; entity-case links and
entity-entity relationships come from the stored graph).

Design rules (see README):
  * Investigative aid only - it does NOT predict criminal activity or infer guilt.
  * No dates are invented. Periods are calendar months derived from real case
    dates. When a range does not contain enough history for a given analysis,
    the analysis reports "Insufficient historical data for this analysis."
  * Every detection is computed from measurable counts (connections gained,
    relationships with a first recorded date, case memberships, connected
    components, activity bursts) and every flagged item carries the exact factors
    that caused it. There is no black-box/ML score.
  * All query values are passed as Cypher parameters; nothing user-supplied is
    interpolated into query text.
"""
import calendar
import logging
from collections import defaultdict
from datetime import datetime
from itertools import combinations
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("crimenet.temporal")

INSUFFICIENT_MESSAGE = "Insufficient historical data for this analysis."

# Result caps (exposed in the response for transparency).
CAPS = {
    "connection_increase_items": 20,
    "new_relationships": 20,
    "new_entities": 15,
    "bridges": 20,
    "activity_bursts": 8,
    "review_items": 25,
    "related_cases_shown": 6,
    "component_members_shown": 8,
}

# Deterministic thresholds (exposed in the response as the applied rules).
THRESHOLDS = {
    "connection_increase": {
        "min_new_connections": 3,
        "require_prior_activity": True,
        "absolute_jump": 3,
        "relative_factor": 2.0,
        "explanation": ("Flag when an entity gains >=3 new case-linked connections in one "
                        "period after having gained >=1 in an earlier period, and the gain "
                        "is >=3 more than (and >2x) its prior gains."),
    },
    "new_relationship": {
        "later_period_only": True,
        "explanation": ("A relationship's first recorded date is the earliest dated case in "
                        "which both endpoints appear. Only relationships first appearing in a "
                        "period later than the network's first observed period are flagged. "
                        "Relationships whose endpoints never co-appear in a dated case have no "
                        "temporal anchor and are excluded."),
    },
    "new_entity": {
        "later_period_only": True,
        "explanation": ("An entity's first recorded activity is the earliest dated case it is "
                        "linked to. Entities whose first activity falls in a period later than "
                        "the network's first observed period are flagged."),
    },
    "bridge_formation": {
        "explanation": ("Network groups are connected components of entities sharing a dated "
                        "case (co-involvement). A static relationship between two entities that "
                        "sit in different components is a bridge edge; it becomes observable at "
                        "max(first activity of A, first activity of B)."),
    },
    "activity_burst": {
        "min_events": 4,
        "min_difference": 3,
        "relative_factor": 2.0,
        "explanation": ("Event count = cases + entities + co-involved pairs in a period. "
                        "Baseline = average event count of the OTHER observed periods in the "
                        "range. Flag when events >= max(min_events, 2x baseline) and events are "
                        ">= baseline + min_difference."),
    },
    "review_score": {
        "connection_increase_weight": 2,
        "new_relationship_weight": 3,
        "related_case_weight": 2,
        "bridge_points": 10,
        "activity_burst_points": 10,
        "high_severity_min": 25,
        "medium_severity_min": 12,
        "explanation": ("Score = min(ci,10)x2 + min(nr,5)x3 + min(rc,5)x2 + (10 if bridge) "
                        "+ (10 if activity burst). High >= 25, Medium >= 12, else Low."),
    },
}


# ── Date / period helpers ───────────────────────────────────────────────────
def _parse_date(value: Any) -> Optional[datetime]:
    if not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d")
    except ValueError:
        return None


def _month_key(dt: datetime) -> Tuple[int, int]:
    return (dt.year, dt.month)


def _month_label(key: Tuple[int, int]) -> str:
    return f"{calendar.month_abbr[key[1]]} {key[0]}"


def _period_str(key: Tuple[int, int]) -> str:
    return f"{key[0]:04d}-{key[1]:02d}"


def _month_bounds(key: Tuple[int, int]) -> Tuple[str, str]:
    year, month = key
    last = calendar.monthrange(year, month)[1]
    return f"{year:04d}-{month:02d}-01", f"{year:04d}-{month:02d}-{last:02d}"


def _date_str(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


# ── Data loading ────────────────────────────────────────────────────────────
def _load_data(db):
    """Return cases, entity-case links, static entity relationships, and a set
    of entities that have any parseable case anchor.

    All values come from the existing database; nothing is synthesized.
    """
    case_rows = db._run_query(
        "MATCH (c:CrimeRecord) RETURN c.id AS id, c.fir_number AS fir_number, "
        "c.title AS title, c.date AS date, c.location AS location, c.status AS status"
    )
    cases = []
    for r in case_rows:
        d = _parse_date(r.get("date"))
        if d is None:
            continue
        cases.append({
            "id": r.get("id", ""),
            "fir_number": r.get("fir_number", ""),
            "title": r.get("title", ""),
            "date": d,
            "date_str": _date_str(d),
            "location": r.get("location", ""),
            "status": r.get("status", ""),
        })

    link_rows = db._run_query(
        "MATCH (e:Entity)-[r]-(c:CrimeRecord) RETURN e.id AS eid, e.name AS ename, "
        "e.entity_type AS etype, c.id AS cid, type(r) AS rel"
    )
    entity_meta: Dict[str, Dict[str, Any]] = {}
    entity_cases_all: Dict[str, set] = defaultdict(set)
    case_entities: Dict[str, set] = defaultdict(set)
    for r in link_rows:
        eid, cid = r.get("eid"), r.get("cid")
        if not eid or not cid:
            continue
        entity_meta[eid] = {
            "id": eid,
            "name": r.get("ename", ""),
            "entity_type": r.get("etype", ""),
        }
        entity_cases_all[eid].add(cid)
        case_entities[cid].add(eid)

    rel_rows = db._run_query(
        "MATCH (a:Entity)-[r]->(b:Entity) RETURN a.id AS aid, a.name AS aname, "
        "a.entity_type AS atype, b.id AS bid, b.name AS bname, b.entity_type AS btype, type(r) AS rel"
    )
    relationships = []
    for r in rel_rows:
        aid, bid = r.get("aid"), r.get("bid")
        if not aid or not bid or aid == bid:
            continue
        relationships.append({
            "aid": aid, "aname": r.get("aname", ""), "atype": r.get("atype", ""),
            "bid": bid, "bname": r.get("bname", ""), "btype": r.get("btype", ""),
            "rel": r.get("rel", ""),
        })

    case_by_id = {c["id"]: c for c in cases}
    return cases, case_by_id, entity_meta, entity_cases_all, case_entities, relationships


# ── Detection A: sudden connection increase ─────────────────────────────────
def _pair_key(a: str, b: str) -> Tuple[str, str]:
    return (a, b) if a <= b else (b, a)


def _detect_connection_increase(gains_per_period, observed, period_cases,
                                period_entities, case_entities, case_by_id):
    """Flag entities whose new case-linked connections jump within one period."""
    items = []
    prior_total: Dict[str, int] = defaultdict(int)
    for ck in observed:
        for eid, gained in gains_per_period.get(ck, {}).items():
            newc = len(gained)
            prior = prior_total[eid]
            th = THRESHOLDS["connection_increase"]
            if (newc >= th["min_new_connections"] and prior >= 1
                    and newc >= prior + th["absolute_jump"]
                    and newc > th["relative_factor"] * prior):
                involved = sorted(
                    [
                        {"id": c["id"], "fir_number": c["fir_number"],
                         "title": c["title"], "date": c["date_str"]}
                        for c in period_cases[ck]
                        if eid in case_entities.get(c["id"], set())
                    ],
                    key=lambda x: x["date"],
                )
                items.append({
                    "kind": "connection_increase",
                    "entity": eid,
                    "period": _period_str(ck),
                    "period_label": _month_label(ck),
                    "previous_count": prior,
                    "new_count": newc,
                    "increase": newc - prior,
                    "connections_gained": sorted(gained),
                    "dates": [c["date_str"] for c in sorted(period_cases[ck], key=lambda x: x["date"])],
                    "related_cases": involved,
                    "why": {
                        "previous_connections": prior,
                        "new_connections": newc,
                        "increase": newc - prior,
                        "rule": THRESHOLDS["connection_increase"]["explanation"],
                    },
                })
            prior_total[eid] += newc
    items.sort(key=lambda x: (-x["increase"], x["entity"]))
    return items


# ── Detection B: new relationships with a first recorded date ───────────────
def _detect_new_relationships(relationships, pair_first_coinv, first_period,
                              case_by_id, observed_start):
    flagged = []
    unanchorable = 0
    for rel in relationships:
        pk = _pair_key(rel["aid"], rel["bid"])
        info = pair_first_coinv.get(pk)
        if info is None:
            unanchorable += 1
            continue
        first_date = info["date"]
        if first_date < observed_start:
            continue  # relationship already existed before the selected range
        ck = _month_key(first_date)
        if ck <= first_period:
            continue  # part of the network's initial formation
        flagged.append({
            "kind": "new_relationship",
            "entity_a": {"id": rel["aid"], "name": rel["aname"], "entity_type": rel["atype"]},
            "entity_b": {"id": rel["bid"], "name": rel["bname"], "entity_type": rel["btype"]},
            "relationship_type": rel["rel"],
            "first_recorded_date": _date_str(first_date),
            "period": _period_str(ck),
            "period_label": _month_label(ck),
            "related_case": {
                "id": info["case_id"], "fir_number": info["fir"],
                "title": info["title"], "date": info["date_str"],
            },
            "why": {
                "first_recorded_date": _date_str(first_date),
                "rule": THRESHOLDS["new_relationship"]["explanation"],
            },
        })
    flagged.sort(key=lambda x: (x["first_recorded_date"], x["entity_a"]["name"]))
    return flagged, len(flagged), unanchorable


# ── Detection C: new entities entering the network ──────────────────────────
def _detect_new_entities(entity_meta, first_activity, first_period, observed_start,
                         relationships, entity_cases_all, case_by_id):
    # Neighbors (static relationships) per entity, used for "initial connections".
    neighbors: Dict[str, set] = defaultdict(set)
    for rel in relationships:
        neighbors[rel["aid"]].add(rel["bid"])
        neighbors[rel["bid"]].add(rel["aid"])

    flagged = []
    for eid, meta in entity_meta.items():
        fa = first_activity.get(eid)
        if fa is None:
            continue
        if fa < observed_start:
            continue  # entity was already present before the selected range
        ck = _month_key(fa)
        if ck <= first_period:
            continue  # part of the network's initial formation
        case = _first_case_of(eid, fa, entity_cases_all, case_by_id)
        init_conns = []
        for nid in sorted(neighbors.get(eid, set())):
            if nid in entity_meta:
                init_conns.append({
                    "id": nid, "name": entity_meta[nid]["name"],
                    "entity_type": entity_meta[nid]["entity_type"],
                })
            else:
                init_conns.append({"id": nid, "name": nid, "entity_type": "Entity"})
        flagged.append({
            "kind": "new_entity",
            "entity": {"id": eid, "name": meta["name"], "entity_type": meta["entity_type"]},
            "first_activity_date": _date_str(fa),
            "period": _period_str(ck),
            "period_label": _month_label(ck),
            "related_case": case,
            "initial_connections": init_conns[:CAPS["component_members_shown"]],
            "initial_connection_count": len(init_conns),
            "why": {
                "first_activity_date": _date_str(fa),
                "rule": THRESHOLDS["new_entity"]["explanation"],
            },
        })
    flagged.sort(key=lambda x: (x["first_activity_date"], x["entity"]["name"]))
    return flagged, len(flagged)


def _first_case_of(eid, fa_date, entity_cases_all, case_by_id):
    own = [c for cid in entity_cases_all.get(eid, set())
           for c in [case_by_id.get(cid)] if c and c["date"] == fa_date]
    if not own:
        return {"id": "", "fir_number": "", "title": "", "date": _date_str(fa_date)}
    # Deterministic pick: the case with the lexicographically smallest id/fir.
    own.sort(key=lambda c: (c["fir_number"], c["id"]))
    h = own[0]
    return {"id": h["id"], "fir_number": h["fir_number"], "title": h["title"], "date": h["date_str"]}


# ── Detection D: bridge formation ────────────────────────────────────────────
class _UnionFind:
    def __init__(self):
        self.parent: Dict[str, str] = {}

    def find(self, x: str) -> str:
        self.parent.setdefault(x, x)
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb

    def components(self) -> Dict[str, List[str]]:
        groups = defaultdict(list)
        for node in self.parent:
            groups[self.find(node)].append(node)
        return groups


def _detect_bridges(relationships, entity_meta, entity_cases_all, case_by_id,
                    window_pairs, first_activity, observed_start):
    uf = _UnionFind()
    for (a, b) in window_pairs:
        if a in entity_meta and b in entity_meta:
            uf.union(a, b)
    comps = uf.components()
    comp_of = {eid: root for root, members in comps.items() for eid in members}

    case_by_entity: Dict[str, List[str]] = {eid: sorted(v) for eid, v in entity_cases_all.items()}
    items = []
    for rel in relationships:
        a, b = rel["aid"], rel["bid"]
        ca = comp_of.get(a)
        cb = comp_of.get(b)
        if ca is None or cb is None or ca == cb:
            continue
        complete_date = max(first_activity.get(a, datetime.min), first_activity.get(b, datetime.min))
        if complete_date < observed_start:
            continue  # bridge already formed before the selected range

        def side(root):
            members = sorted(comps.get(root, []))
            shown = members[:CAPS["component_members_shown"]]
            case_ids = set()
            for m in members:
                case_ids.update(case_by_entity.get(m, []))
            mcases = [
                {"id": case_by_id[cid]["id"], "fir_number": case_by_id[cid]["fir_number"],
                 "title": case_by_id[cid]["title"], "date": case_by_id[cid]["date_str"]}
                for cid in sorted(case_ids, key=lambda x: case_by_id[x]["fir_number"])
            ][:CAPS["related_cases_shown"]]
            return {
                "component_id": root,
                "size": len(members),
                "entities": [{"id": m, "name": entity_meta[m]["name"],
                              "entity_type": entity_meta[m]["entity_type"]} for m in shown],
                "cases": mcases,
            }

        items.append({
            "kind": "bridge_formation",
            "source": {"id": a, "name": rel["aname"], "entity_type": rel["atype"]},
            "target": {"id": b, "name": rel["bname"], "entity_type": rel["btype"]},
            "relationship_type": rel["rel"],
            "component_a": side(ca),
            "component_b": side(cb),
            "bridge_date": _date_str(complete_date),
            "period": _period_str(_month_key(complete_date)),
            "period_label": _month_label(_month_key(complete_date)),
            "why": {
                "complete_date": _date_str(complete_date),
                "rule": THRESHOLDS["bridge_formation"]["explanation"],
            },
        })
    items.sort(key=lambda x: (x["bridge_date"], x["source"]["name"]))
    return items, len(items)


# ── Detection E: activity burst ─────────────────────────────────────────────
def _detect_activity_bursts(period_events, observed):
    th = THRESHOLDS["activity_burst"]
    items = []
    for ck in observed:
        events = period_events[ck]
        others = [period_events[k] for k in observed if k != ck]
        baseline = round(sum(others) / len(others), 1) if others else 0.0
        diff = round(events - baseline, 1)
        if events >= max(th["min_events"], th["relative_factor"] * baseline) and diff >= th["min_difference"]:
            items.append({
                "kind": "activity_burst",
                "period": _period_str(ck),
                "period_label": _month_label(ck),
                "event_count": events,
                "baseline_count": baseline,
                "difference": diff,
                "why": {
                    "event_count": events,
                    "baseline_count": baseline,
                    "difference": diff,
                    "rule": th["explanation"],
                },
            })
    items.sort(key=lambda x: (-x["difference"], x["period"]))
    return items


# ── Review / scoring ────────────────────────────────────────────────────────
def _build_review_items(connection_items, relationship_items, entity_items, bridge_items,
                        bursts, entity_meta):
    """Aggregate detection factors per entity into a transparent review score."""
    flags: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "connection_increase": 0,
        "new_relationships": 0,
        "related_cases": set(),
        "bridge_formation": False,
        "activity_burst": False,
        "periods": set(),
    })
    burst_periods = {b["period"] for b in bursts}

    def add_related(eid, case):
        if case and case.get("id"):
            flags[eid]["related_cases"].add(case["id"])

    for it in connection_items:
        f = flags[it["entity"]]
        f["connection_increase"] = it["increase"]
        f["periods"].add(it["period"])
        for c in it["related_cases"]:
            add_related(it["entity"], c)
    for it in relationship_items:
        for eid in (it["entity_a"]["id"], it["entity_b"]["id"]):
            flags[eid]["new_relationships"] += 1
            flags[eid]["periods"].add(it["period"])
            add_related(eid, it["related_case"])
    for it in entity_items:
        eid = it["entity"]["id"]
        flags[eid]["periods"].add(it["period"])
        if it["period"] in burst_periods:
            flags[eid]["activity_burst"] = True
        add_related(eid, it["related_case"])
    for it in bridge_items:
        for eid in (it["source"]["id"], it["target"]["id"]):
            flags[eid]["bridge_formation"] = True
            flags[eid]["periods"].add(it["period"])
            for side in (it["component_a"], it["component_b"]):
                for c in side["cases"]:
                    add_related(eid, c)

    schema = THRESHOLDS["review_score"]
    items = []
    for eid, f in flags.items():
        # Only entities that were actually flagged by a detection get a score;
        # "related cases" only adds weight, it never flags on its own.
        if not (f["connection_increase"] or f["new_relationships"]
                or f["bridge_formation"] or f["activity_burst"]):
            continue
        meta = entity_meta.get(eid, {"id": eid, "name": eid, "entity_type": "Entity"})
        ci = f["connection_increase"]
        nr = f["new_relationships"]
        rc = len(f["related_cases"])
        score = (min(ci, 10) * schema["connection_increase_weight"]
                 + min(nr, 5) * schema["new_relationship_weight"]
                 + min(rc, 5) * schema["related_case_weight"]
                 + (schema["bridge_points"] if f["bridge_formation"] else 0)
                 + (schema["activity_burst_points"] if f["activity_burst"] else 0))
        if score <= 0:
            continue
        severity = "High" if score >= schema["high_severity_min"] else (
            "Medium" if score >= schema["medium_severity_min"] else "Low")
        lines = [
            f"Connection increase: +{ci}",
            f"New relationships: {nr}",
            f"Related cases: {rc}",
            f"Bridge formation: {'Yes' if f['bridge_formation'] else 'No'}",
            f"Activity burst: {'Yes' if f['activity_burst'] else 'No'}",
        ]
        items.append({
            "entity": {"id": eid, "name": meta["name"], "entity_type": meta["entity_type"]},
            "score": score,
            "severity": severity,
            "factors": {
                "connection_increase": ci,
                "new_relationships": nr,
                "related_cases": rc,
                "bridge_formation": f["bridge_formation"],
                "activity_burst": f["activity_burst"],
            },
            "reason": "; ".join(lines),
            "reason_lines": lines,
            "periods": sorted(f["periods"]),
            "related_case_ids": sorted(f["related_cases"]),
        })
    items.sort(key=lambda x: (-x["score"], x["entity"]["name"]))
    return items, len(items)


# ── Main entrypoint ─────────────────────────────────────────────────────────
def analyze(db, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    """Run the full temporal analysis for the [start_date, end_date] window.

    start_date/end_date are clamped to the data's min/max case dates; all
    comparisons are made inside the selected window.
    """
    cases, case_by_id, entity_meta, entity_cases_all, case_entities, relationships = _load_data(db)
    data_min = min((c["date"] for c in cases), default=None)
    data_max = max((c["date"] for c in cases), default=None)

    start = max(start_date, data_min) if data_min else start_date
    end = min(end_date, data_max) if data_max else end_date

    window_cases = [c for c in cases if start <= c["date"] <= end]
    observed = sorted({_month_key(c["date"]) for c in window_cases})
    insufficient = len(observed) < 2

    # First recorded activity per entity (across all history).
    first_activity: Dict[str, datetime] = {}
    for eid, cids in entity_cases_all.items():
        dates = [case_by_id[cid]["date"] for cid in cids if cid in case_by_id]
        if dates:
            first_activity[eid] = min(dates)

    # First co-involvement date per entity-pair (across all history).
    pair_first_coinv: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for cid, ents in case_entities.items():
        c = case_by_id.get(cid)
        if c is None:
            continue
        for a, b in combinations(sorted(ents), 2):
            pk = _pair_key(a, b)
            existing = pair_first_coinv.get(pk)
            if existing is None or c["date"] < existing["date"]:
                pair_first_coinv[pk] = {
                    "date": c["date"], "date_str": c["date_str"],
                    "case_id": c["id"], "fir": c["fir_number"], "title": c["title"],
                }

    # Windowed period datasets.
    period_cases: Dict[Tuple[int, int], List[Dict]] = defaultdict(list)
    for c in window_cases:
        period_cases[_month_key(c["date"])].append(c)
    period_entities: Dict[Tuple[int, int], set] = defaultdict(set)
    for ck, cs in period_cases.items():
        for c in cs:
            period_entities[ck].update(case_entities.get(c["id"], set()))
    # Co-involved pairs within the window.
    window_pairs = set()
    period_pairs: Dict[Tuple[int, int], set] = defaultdict(set)
    for ck in period_cases:
        for c in period_cases[ck]:
            ents = sorted(case_entities.get(c["id"], set()))
            for a, b in combinations(ents, 2):
                pk = _pair_key(a, b)
                window_pairs.add(pk)
                period_pairs[ck].add(pk)
    period_events = {
        ck: len(period_cases[ck]) + len(period_entities[ck]) + len(period_pairs[ck])
        for ck in observed
    }

    # Detection A: gains per period per entity (co-involvement with a first
    # recorded date inside the window).
    gains_per_period: Dict[Tuple[int, int], Dict[str, set]] = defaultdict(lambda: defaultdict(set))
    for pk, info in pair_first_coinv.items():
        if not (start <= info["date"] <= end):
            continue
        ck = _month_key(info["date"])
        gains_per_period[ck][pk[0]].add(pk[1])
        gains_per_period[ck][pk[1]].add(pk[0])

    first_period = observed[0] if observed else None

    connection_items = []
    relationship_items = []
    entity_items = []
    bridge_items = []
    burst_items = []
    rel_total = ent_total = bridge_total = 0
    unanchorable = 0
    disappeared_message = INSUFFICIENT_MESSAGE
    messages = {}

    if insufficient:
        for key in ("connection_increase", "new_relationships", "new_entities",
                    "bridge_formation", "activity_burst", "disappeared_relationships"):
            messages[key] = INSUFFICIENT_MESSAGE
    else:
        connection_items = _detect_connection_increase(
            gains_per_period, observed, period_cases, period_entities,
            case_entities, case_by_id)
        messages["connection_increase"] = (
            None if connection_items else
            "No entity gained 3+ new connections in a single period after prior recorded activity."
        )

        relationship_items, rel_total, unanchorable = _detect_new_relationships(
            relationships, pair_first_coinv, first_period, case_by_id, start)
        messages["new_relationships"] = (
            None if relationship_items else
            "No relationships with a first recorded date in a later period were detected.")
        messages["new_relationships_note"] = (
            f"{unanchorable} relationship(s) have no temporal anchor "
            "because their endpoints never co-appear in a dated case.")

        entity_items, ent_total = _detect_new_entities(
            entity_meta, first_activity, first_period, start, relationships,
            entity_cases_all, case_by_id)
        messages["new_entities"] = (
            None if entity_items else
            "No entities first entered the network during the selected range.")

        bridge_items, bridge_total = _detect_bridges(
            relationships, entity_meta, entity_cases_all, case_by_id, window_pairs,
            first_activity, start)
        messages["bridge_formation"] = (
            None if bridge_items else
            "No bridge relationships between previously separate network groups were detected.")

        burst_items = _detect_activity_bursts(period_events, observed)
        messages["activity_burst"] = (
            None if burst_items else
            "No period showed an event count significantly above the observed baseline.")

    # Disappearing relationships: the schema stores no end dates / deletions,
    # so the available history never supports this analysis.
    messages["disappeared_relationships"] = disappeared_message

    if insufficient:
        review_items = []
        review_total = 0
    else:
        review_items, review_total = _build_review_items(
            connection_items, relationship_items, entity_items, bridge_items,
            burst_items, entity_meta)

    def cap(items, key, limit):
        return {"items": items[:limit], "total": len(items), "shown": min(len(items), limit)}

    detections = {
        "connection_increase": {
            "message": messages.get("connection_increase"),
            **cap(connection_items, "connection_increase", CAPS["connection_increase_items"]),
        },
        "new_relationships": {
            "message": messages.get("new_relationships"),
            "note": messages.get("new_relationships_note"),
            **cap(relationship_items, "new_relationships", CAPS["new_relationships"]),
        },
        "new_entities": {
            "message": messages.get("new_entities"),
            **cap(entity_items, "new_entities", CAPS["new_entities"]),
        },
        "bridge_formation": {
            "message": messages.get("bridge_formation"),
            **cap(bridge_items, "bridges", CAPS["bridges"]),
        },
        "activity_burst": {
            "message": messages.get("activity_burst"),
            **cap(burst_items, "activity_bursts", CAPS["activity_bursts"]),
        },
        "disappeared_relationships": {
            "message": disappeared_message,
            "items": [],
            "total": 0,
            "shown": 0,
        },
    }
    review_block = {
        "items": review_items[:CAPS["review_items"]],
        "total": review_total,
        "shown": min(review_total, CAPS["review_items"]),
    }

    # Summary period rows.
    window_entity_ids = set()
    window_pair_ids = set()
    for ck in observed:
        window_entity_ids.update(period_entities[ck])
        window_pair_ids.update(period_pairs[ck])
    period_rows = []
    for ck in observed:
        cases_in = sorted(period_cases[ck], key=lambda x: x["date_str"])
        b0, b1 = _month_bounds(ck)
        period_rows.append({
            "period": _period_str(ck),
            "label": _month_label(ck),
            "start_date": b0,
            "end_date": b1,
            "case_count": len(period_cases[ck]),
            "entity_count": len(period_entities[ck]),
            "relationship_count": len(period_pairs[ck]),
            "event_count": period_events[ck],
            "cases": [
                {"id": c["id"], "fir_number": c["fir_number"], "title": c["title"],
                 "date": c["date_str"], "status": c.get("status", "")}
                for c in cases_in
            ],
        })

    summary = {
        "total_cases": len(window_cases),
        "total_entities": len(window_entity_ids),
        "total_relationship_events": len(window_pair_ids),
        "period_count": len(period_rows),
        "periods": period_rows,
        "avg_event_count": round(sum(period_events.values()) / len(period_events), 1) if period_events else 0,
    }

    return {
        "status": "ok",
        "granularity": "month",
        "insufficient_overall": insufficient,
        "time_range": {
            "data_min_date": _date_str(data_min) if data_min else None,
            "data_max_date": _date_str(data_max) if data_max else None,
            "requested_start_date": _date_str(start_date),
            "requested_end_date": _date_str(end_date),
            "effective_start_date": _date_str(start),
            "effective_end_date": _date_str(end),
        },
        "summary": summary,
        "detections": detections,
        "review_items": review_block["items"],
        "review_summary": {"total": review_block["total"], "shown": review_block["shown"]},
        "rules": THRESHOLDS,
        "caps": CAPS,
    }