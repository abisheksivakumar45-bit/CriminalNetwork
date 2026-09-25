from neo4j import GraphDatabase
from typing import Optional, List, Dict, Any
import uuid
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, NEO4J_DATABASE

# Relationship types are interpolated into Cypher labels (Neo4j cannot
# parameterize labels/relationship types). Only allow a strict safe pattern;
# every caller uses validated enums or hardcoded values, so this never matches
# in normal operation — it is defense-in-depth against future callers.
_REL_TYPE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")

# Path depth bound: protects against deep-traversal resource exhaustion.
MAX_PATH_DEPTH = 10


class Neo4jService:
    def __init__(self):
        self.driver = None
        self._connect()

    def _connect(self):
        try:
            self.driver = GraphDatabase.driver(
                NEO4J_URI,
                auth=(NEO4J_USER, NEO4J_PASSWORD)
            )
            self.driver.verify_connectivity()
            print(f"Connected to Neo4j at {NEO4J_URI}")
        except Exception as e:
            print(f"Failed to connect to Neo4j: {e}")
            self.driver = None

    def ensure_connected(self):
        if not self.driver:
            self._connect()
        if not self.driver:
            raise Exception("Neo4j driver not connected")

    def close(self):
        if self.driver:
            self.driver.close()

    def _run_query(self, query: str, parameters: dict = None, database: str = None) -> List[Dict]:
        self.ensure_connected()
        db = database or NEO4J_DATABASE
        with self.driver.session(database=db) as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]

    def _run_write(self, query: str, parameters: dict = None) -> List[Dict]:
        return self._run_query(query, parameters)

    def setup_indexes(self):
        queries = [
            "CREATE INDEX entity_id IF NOT EXISTS FOR (n:Entity) ON (n.id)",
            "CREATE INDEX entity_name IF NOT EXISTS FOR (n:Entity) ON (n.name)",
            "CREATE INDEX entity_type IF NOT EXISTS FOR (n:Entity) ON (n.entity_type)",
            "CREATE INDEX crime_id IF NOT EXISTS FOR (n:CrimeRecord) ON (n.id)",
            "CREATE INDEX crime_fir IF NOT EXISTS FOR (n:CrimeRecord) ON (n.fir_number)",
        ]
        for q in queries:
            try:
                self._run_write(q)
            except Exception as e:
                if "already exists" not in str(e).lower():
                    print(f"Index creation warning: {e}")

    def clear_database(self):
        # Wipe only the investigation graph (Entity / CrimeRecord / relationships).
        # The AuthUser store is an application-account store, NOT investigation
        # data — deleting it would silently sign out and remove every account
        # (including admins). It is therefore preserved.
        self._run_write("MATCH (n) WHERE NOT n:AuthUser DETACH DELETE n")

    # ─── Entity CRUD ───
    def create_entity(self, entity_type: str, name: str, properties: dict = None) -> dict:
        entity_id = str(uuid.uuid4())[:8]
        props = {}
        if properties:
            for k, v in properties.items():
                if isinstance(v, list):
                    props[k] = ", ".join(str(x) for x in v) if v else ""
                elif isinstance(v, (str, int, float, bool)):
                    props[k] = v
                else:
                    props[k] = str(v)
        props["id"] = entity_id
        props["name"] = name
        props["entity_type"] = entity_type
        props["centrality_score"] = 0.0
        props["connection_count"] = 0
        query = "CREATE (n:Entity $props) RETURN n"
        results = self._run_write(query, {"props": props})
        return results[0]["n"] if results else props

    def get_entity(self, entity_id: str) -> Optional[dict]:
        results = self._run_query(
            "MATCH (n:Entity {id: $id}) RETURN n", {"id": entity_id}
        )
        return dict(results[0]["n"]) if results else None

    def get_entity_by_name(self, name: str) -> Optional[dict]:
        results = self._run_query(
            "MATCH (n:Entity {name: $name}) RETURN n", {"name": name}
        )
        return dict(results[0]["n"]) if results else None

    def find_or_create_entity(self, entity_type: str, name: str, properties: dict = None) -> dict:
        # Cap entity names (the API already enforces 200 chars via Pydantic,
        # but NLP-extracted names and seed data bypass validation). Neo4j's
        # range index rejects indexed string values ~>20 KB, so over-long names
        # would make every future lookup/write fail.
        safe_name = (name or "").strip()[:200]
        if not safe_name:
            return {}
        existing = self.get_entity_by_name(safe_name)
        if existing:
            return existing
        return self.create_entity(entity_type, safe_name, properties)

    def get_all_entities(self, entity_type: str = None) -> List[dict]:
        if entity_type:
            results = self._run_query(
                "MATCH (n:Entity {entity_type: $type}) RETURN n ORDER BY n.centrality_score DESC",
                {"type": entity_type}
            )
        else:
            results = self._run_query(
                "MATCH (n:Entity) RETURN n ORDER BY n.centrality_score DESC"
            )
        return [dict(r["n"]) for r in results]

    def search_entities(self, query: str) -> List[dict]:
        results = self._run_query(
            "MATCH (n:Entity) WHERE toLower(n.name) CONTAINS toLower($query) RETURN n ORDER BY n.centrality_score DESC LIMIT 50",
            {"query": query}
        )
        return [dict(r["n"]) for r in results]

    def delete_entity(self, entity_id: str):
        self._run_write("MATCH (n:Entity {id: $id}) DETACH DELETE n", {"id": entity_id})

    def _sanitize_rel_type(self, rel_type: str) -> str:
        safe = (rel_type or "").strip().upper()
        if not _REL_TYPE_PATTERN.fullmatch(safe):
            raise ValueError(f"Invalid relationship type: {rel_type!r}")
        return safe

    # ─── Relationship CRUD ───
    def create_relationship(self, source_id: str, target_id: str, rel_type: str, properties: dict = None) -> dict:
        rel_label = self._sanitize_rel_type(rel_type)
        props = {}
        if properties:
            for k, v in properties.items():
                if isinstance(v, (str, int, float, bool)):
                    props[k] = v
                else:
                    props[k] = str(v) if v else ""
        props["id"] = str(uuid.uuid4())[:8]
        props["relationship_type"] = rel_label

        query = f"""
            MATCH (a:Entity {{id: $source_id}})
            MATCH (b:Entity {{id: $target_id}})
            CREATE (a)-[r:{rel_label}]->(b)
            SET r = $props
            RETURN r, a.id as source_id, b.id as target_id
        """
        results = self._run_write(query, {
            "source_id": source_id,
            "target_id": target_id,
            "props": props
        })
        if results:
            return {
                "id": props["id"],
                "source": results[0]["source_id"],
                "target": results[0]["target_id"],
                "relationship_type": rel_label,
                "properties": props,
            }
        return props

    def create_crime_relationship(self, entity_id: str, crime_id: str, rel_type: str) -> dict:
        rel_label = self._sanitize_rel_type(rel_type)
        props = {
            "id": str(uuid.uuid4())[:8],
            "relationship_type": rel_label,
        }
        query = f"""
            MATCH (a:Entity {{id: $entity_id}})
            MATCH (b:CrimeRecord {{id: $crime_id}})
            CREATE (a)-[r:{rel_label}]->(b)
            SET r = $props
            RETURN r, a.id as source_id, b.id as target_id
        """
        results = self._run_write(query, {
            "entity_id": entity_id,
            "crime_id": crime_id,
            "props": props,
        })
        return {"id": props["id"], "source": entity_id, "target": crime_id, "relationship_type": rel_label}

    def get_relationships(self, entity_id: str = None) -> List[dict]:
        if entity_id:
            results = self._run_query("""
                MATCH (a:Entity {id: $id})-[r]->(b)
                RETURN a.id as source, b.id as target, type(r) as rel_type, r.id as rel_id
                UNION
                MATCH (a)-[r]->(b:Entity {id: $id})
                RETURN a.id as source, b.id as target, type(r) as rel_type, r.id as rel_id
            """, {"id": entity_id})
        else:
            results = self._run_query("""
                MATCH (a)-[r]->(b)
                RETURN a.id as source, b.id as target, type(r) as rel_type, r.id as rel_id
            """)
        rels = []
        for r in results:
            rels.append({
                "id": r.get("rel_id", ""),
                "source": r.get("source", ""),
                "target": r.get("target", ""),
                "relationship_type": r.get("rel_type", ""),
                "properties": {},
            })
        return rels

    def get_entity_relationships_only(self, entity_id: str = None) -> List[dict]:
        """Get only Entity-to-Entity relationships (for network graph)."""
        if entity_id:
            results = self._run_query("""
                MATCH (a:Entity {id: $id})-[r]->(b:Entity)
                RETURN a.id as source, b.id as target, type(r) as rel_type, r.id as rel_id
                UNION
                MATCH (a:Entity)-[r]->(b:Entity {id: $id})
                RETURN a.id as source, b.id as target, type(r) as rel_type, r.id as rel_id
            """, {"id": entity_id})
        else:
            results = self._run_query("""
                MATCH (a:Entity)-[r]->(b:Entity)
                RETURN a.id as source, b.id as target, type(r) as rel_type, r.id as rel_id
            """)
        rels = []
        for r in results:
            rels.append({
                "id": r.get("rel_id", ""),
                "source": r.get("source", ""),
                "target": r.get("target", ""),
                "relationship_type": r.get("rel_type", ""),
                "properties": {},
            })
        return rels

    def get_all_relationships(self) -> List[dict]:
        """Get all relationships including CrimeRecord links."""
        results = self._run_query("""
            MATCH (a)-[r]->(b)
            RETURN a.id as source, b.id as target, type(r) as rel_type,
                   r.id as rel_id, labels(a)[0] as source_label, labels(b)[0] as target_label
        """)
        rels = []
        for r in results:
            rels.append({
                "id": r.get("rel_id", ""),
                "source": r.get("source", ""),
                "target": r.get("target", ""),
                "relationship_type": r.get("rel_type", ""),
                "source_label": r.get("source_label", ""),
                "target_label": r.get("target_label", ""),
                "properties": {},
            })
        return rels

    def get_connected_entities(self, entity_id: str) -> List[dict]:
        results = self._run_query("""
            MATCH (a:Entity {id: $id})-[r]-(b:Entity)
            RETURN b.id as id, b.name as name, b.entity_type as entity_type,
                   b.centrality_score as centrality_score, b.connection_count as connection_count,
                   type(r) as rel_type
            ORDER BY b.centrality_score DESC
        """, {"id": entity_id})
        entities = []
        for r in results:
            entities.append({
                "entity": {
                    "id": r.get("id"),
                    "name": r.get("name"),
                    "entity_type": r.get("entity_type"),
                    "centrality_score": r.get("centrality_score", 0),
                    "connection_count": r.get("connection_count", 0),
                },
                "rel_type": r.get("rel_type"),
            })
        return entities

    def get_entity_related_cases(self, entity_id: str) -> List[dict]:
        results = self._run_query("""
            MATCH (e:Entity {id: $id})-[r]-(c:CrimeRecord)
            RETURN c.id as id, c.fir_number as fir_number, c.title as title,
                   c.date as date, c.location as location, c.status as status,
                   c.ipc_sections as ipc_sections, type(r) as rel_type
            ORDER BY c.date DESC
        """, {"id": entity_id})
        return [
            {
                "id": r.get("id"),
                "fir_number": r.get("fir_number", ""),
                "title": r.get("title", ""),
                "date": r.get("date", ""),
                "location": r.get("location", ""),
                "status": r.get("status", ""),
                "ipc_sections": r.get("ipc_sections", ""),
                "rel_type": r.get("rel_type", ""),
            }
            for r in results
        ]

    def get_entity_by_type(self, entity_id: str, related_type: str) -> List[dict]:
        results = self._run_query("""
            MATCH (a:Entity {id: $id})-[r]-(b:Entity {entity_type: $type})
            RETURN b.id as id, b.name as name, b.entity_type as entity_type,
                   b.centrality_score as centrality_score, b.connection_count as connection_count,
                   type(r) as rel_type
        """, {"id": entity_id, "type": related_type})
        return [{"id": r["id"], "name": r["name"], "entity_type": r["entity_type"],
                 "centrality_score": r.get("centrality_score", 0),
                 "connection_count": r.get("connection_count", 0)} for r in results]

    # ─── Crime Records ───
    def create_crime_record(self, data: dict) -> dict:
        record_id = data.get("id", str(uuid.uuid4())[:8])
        clean_data = {}
        for k, v in data.items():
            if isinstance(v, (str, int, float, bool)):
                clean_data[k] = v
            elif v is None:
                clean_data[k] = ""
            else:
                clean_data[k] = str(v)
        clean_data["id"] = record_id
        query = "CREATE (c:CrimeRecord $props) RETURN c"
        results = self._run_write(query, {"props": clean_data})
        return dict(results[0]["c"]) if results else clean_data

    def get_all_crime_records(self) -> List[dict]:
        results = self._run_query("MATCH (c:CrimeRecord) RETURN c ORDER BY c.date DESC")
        return [dict(r["c"]) for r in results]

    def get_crime_record(self, record_id: str) -> Optional[dict]:
        results = self._run_query(
            "MATCH (c:CrimeRecord {id: $id}) RETURN c", {"id": record_id}
        )
        return dict(results[0]["c"]) if results else None

    def link_entity_to_crime(self, entity_id: str, crime_id: str, rel_type: str = "SUSPECTED_IN"):
        self.create_crime_relationship(entity_id, crime_id, rel_type)

    def get_crime_entities(self, crime_id: str) -> List[dict]:
        results = self._run_query("""
            MATCH (e:Entity)-[r]->(c:CrimeRecord {id: $crime_id})
            RETURN e.id as id, e.name as name, e.entity_type as entity_type,
                   e.centrality_score as centrality_score, e.connection_count as connection_count,
                   type(r) as rel_type
            UNION
            MATCH (c:CrimeRecord {id: $crime_id})-[r]->(e:Entity)
            RETURN e.id as id, e.name as name, e.entity_type as entity_type,
                   e.centrality_score as centrality_score, e.connection_count as connection_count,
                   type(r) as rel_type
        """, {"crime_id": crime_id})
        return [dict(r) for r in results]

    # ─── Path Finding ───
    def find_path(self, source_id: str, target_id: str, max_depth: int = 6) -> List[dict]:
        if not source_id or not target_id:
            return []
        if source_id == target_id:
            # Neo4j's shortestPath raises when start == end; a self-path is
            # not meaningful, so return "no path".
            return []
        try:
            depth = int(max_depth)
        except (TypeError, ValueError):
            depth = 6
        depth = max(1, min(depth, MAX_PATH_DEPTH))
        results = self._run_query(f"""
            MATCH path = shortestPath(
                (a:Entity {{id: $source_id}})-[*1..{depth}]-(b:Entity {{id: $target_id}})
            )
            RETURN [n IN nodes(path) | {{id: n.id, name: n.name, entity_type: n.entity_type}}] as nodes,
                   length(path) as path_length
            LIMIT 5
        """, {"source_id": source_id, "target_id": target_id})
        return results

    # ─── Statistics ───
    def get_stats(self) -> dict:
        stats = {}

        # Entity counts by type
        for etype in ["Person", "Phone", "Vehicle", "Location", "Organization"]:
            results = self._run_query(
                "MATCH (n:Entity {entity_type: $type}) RETURN count(n) as count",
                {"type": etype}
            )
            stats[f"total_{etype.lower()}s"] = results[0]["count"] if results else 0

        # Total entities
        results = self._run_query("MATCH (n:Entity) RETURN count(n) as count")
        stats["total_entities"] = results[0]["count"] if results else 0

        # Crime records
        results = self._run_query("MATCH (c:CrimeRecord) RETURN count(c) as count")
        stats["total_cases"] = results[0]["count"] if results else 0

        # All relationships (including Entity-CrimeRecord)
        results = self._run_query("MATCH ()-[r]->() RETURN count(r) as count")
        stats["total_relationships"] = results[0]["count"] if results else 0

        # Entity-to-Entity relationships only
        results = self._run_query("""
            MATCH (a:Entity)-[r]->(b:Entity)
            RETURN count(r) as count
        """)
        stats["total_entity_relationships"] = results[0]["count"] if results else 0

        # Relationship type breakdown
        results = self._run_query("""
            MATCH (a)-[r]->(b)
            RETURN type(r) as rel_type, count(r) as count
            ORDER BY count(r) DESC
        """)
        stats["relationship_types"] = [{"type": r["rel_type"], "count": r["count"]} for r in results]

        return stats


db_service = Neo4jService()
