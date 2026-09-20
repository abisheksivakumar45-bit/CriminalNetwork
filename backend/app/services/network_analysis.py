import networkx as nx
from typing import List, Dict, Tuple
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


class NetworkAnalysisService:
    def __init__(self):
        self.graph = nx.DiGraph()

    def build_graph(self, entities: List[dict], relationships: List[dict]):
        self.graph.clear()

        for entity in entities:
            self.graph.add_node(
                entity["id"],
                name=entity.get("name", ""),
                entity_type=entity.get("entity_type", ""),
                **{k: v for k, v in entity.items() if k not in ("id", "name", "entity_type")}
            )

        for rel in relationships:
            source = rel.get("source", "")
            target = rel.get("target", "")
            if source in self.graph and target in self.graph:
                self.graph.add_edge(
                    source, target,
                    relationship_type=rel.get("relationship_type", "ASSOCIATED_WITH"),
                    **{k: v for k, v in rel.items() if k not in ("source", "target", "relationship_type", "id", "properties")}
                )

    def calculate_centrality(self) -> Dict[str, float]:
        if len(self.graph) == 0:
            return {}

        undirected = self.graph.to_undirected()

        try:
            degree_cent = nx.degree_centrality(undirected)
        except Exception:
            degree_cent = {n: 0 for n in self.graph.nodes()}

        try:
            between_cent = nx.betweenness_centrality(undirected, normalized=True)
        except Exception:
            between_cent = {n: 0 for n in self.graph.nodes()}

        try:
            if nx.is_connected(undirected):
                closeness_cent = nx.closeness_centrality(undirected)
            else:
                closeness_cent = {n: 0 for n in self.graph.nodes()}
        except Exception:
            closeness_cent = {n: 0 for n in self.graph.nodes()}

        combined = {}
        for node in self.graph.nodes():
            combined[node] = (
                0.3 * degree_cent.get(node, 0) +
                0.4 * between_cent.get(node, 0) +
                0.3 * closeness_cent.get(node, 0)
            )

        return combined

    def get_degree_scores(self) -> Dict[str, int]:
        return dict(self.graph.degree())

    def detect_communities(self) -> List[List[str]]:
        if len(self.graph) == 0:
            return []

        undirected = self.graph.to_undirected()
        try:
            from networkx.algorithms.community import greedy_modularity_communities
            communities = greedy_modularity_communities(undirected)
            return [list(c) for c in communities]
        except Exception:
            try:
                from networkx.algorithms.community import label_propagation_communities
                communities = list(label_propagation_communities(undirected))
                return [list(c) for c in communities]
            except Exception:
                return []

    def find_high_risk_entities(self, centrality: Dict[str, float], top_n: int = 10) -> List[str]:
        if not centrality:
            return []
        sorted_entities = sorted(centrality.items(), key=lambda x: x[1], reverse=True)
        return [eid for eid, _ in sorted_entities[:top_n]]

    def detect_suspicious_patterns(self) -> List[Dict]:
        patterns = []
        undirected = self.graph.to_undirected()

        # Pattern 1: Triangle formation (tight-knit groups)
        try:
            triangles = list(nx.enumerate_all_cliques(undirected))
            triangle_groups = [c for c in triangles if len(c) == 3]
            if triangle_groups:
                patterns.append({
                    "type": "triangle_cluster",
                    "description": f"Found {len(triangle_groups)} tight-knit groups (triangles) in the network",
                    "severity": "medium",
                    "entity_groups": triangle_groups[:5]
                })
        except Exception:
            pass

        # Pattern 2: Hub entities (high degree)
        degree = dict(self.graph.degree())
        hubs = [n for n, d in degree.items() if d >= 4]
        if hubs:
            hub_names = [self.graph.nodes[n].get("name", n) for n in hubs[:5]]
            patterns.append({
                "type": "hub_entity",
                "description": f"Found {len(hubs)} hub entities with 4+ connections: {', '.join(hub_names)}",
                "severity": "high",
                "entities": hubs[:5]
            })

        # Pattern 3: Bridge entities (high betweenness)
        try:
            between_cent = nx.betweenness_centrality(undirected)
            bridges = [n for n, b in between_cent.items() if b > 0.2]
            if bridges:
                bridge_names = [self.graph.nodes[n].get("name", n) for n in bridges[:5]]
                patterns.append({
                    "type": "bridge_entity",
                    "description": f"Found {len(bridges)} bridge entities connecting different groups: {', '.join(bridge_names)}",
                    "severity": "medium",
                    "entities": bridges[:5]
                })
        except Exception:
            pass

        # Pattern 4: Isolated pairs
        isolated = []
        for node in self.graph.nodes():
            if self.graph.degree(node) == 1:
                neighbor = list(self.graph.neighbors(node))[0] if self.graph.out_degree(node) == 1 else list(self.graph.predecessors(node))[0]
                isolated.append((node, neighbor))
        if isolated:
            patterns.append({
                "type": "isolated_pairs",
                "description": f"Found {len(isolated)} isolated pairs with minimal connections",
                "severity": "low",
                "pairs": isolated[:5]
            })

        # Pattern 5: Bidirectional relationships
        bidirectional = []
        for u, v in self.graph.edges():
            if self.graph.has_edge(v, u):
                bidirectional.append((u, v))
        if bidirectional:
            patterns.append({
                "type": "bidirectional_relationships",
                "description": f"Found {len(bidirectional)} bidirectional relationships suggesting mutual involvement",
                "severity": "high",
                "pairs": bidirectional[:5]
            })

        return patterns

    REVIEW_DISCLAIMER = (
        "Network Risk Indicator based on measurable graph data. "
        "This is an investigative aid and does not determine criminal activity or guilt."
    )

    def get_entity_network_analysis(self, entity_id: str) -> dict:
        empty = {
            "degree": 0,
            "betweenness": 0.0,
            "centrality_score": 0.0,
            "centrality_rank": 0,
            "total_entities": 0,
            "cluster_count": 0,
            "largest_cluster_size": 0,
            "is_hub": False,
            "is_bridge": False,
            "connected_entity_count": 0,
            "person_count": 0,
            "organization_count": 0,
            "location_count": 0,
            "phone_count": 0,
            "vehicle_count": 0,
        }
        if entity_id not in self.graph or len(self.graph) == 0:
            return empty

        degree = self.graph.degree(entity_id)
        undirected = self.graph.to_undirected()

        try:
            betweenness = nx.betweenness_centrality(undirected).get(entity_id, 0)
        except Exception:
            betweenness = 0

        centrality = self.calculate_centrality()

        try:
            communities = self.detect_communities()
        except Exception:
            communities = []

        entity_communities = [c for c in communities if entity_id in c]
        cluster_count = len(entity_communities)
        largest_cluster_size = max((len(c) for c in entity_communities), default=0)

        neighbors = set(list(self.graph.neighbors(entity_id)) + list(self.graph.predecessors(entity_id)))
        type_counts = {"Person": 0, "Organization": 0, "Location": 0, "Phone": 0, "Vehicle": 0}
        for nid in neighbors:
            ntype = self.graph.nodes[nid].get("entity_type", "")
            if ntype in type_counts:
                type_counts[ntype] += 1

        total = len(self.graph)
        rank = 0
        if centrality:
            sorted_cent = sorted(centrality.items(), key=lambda kv: kv[1], reverse=True)
            rank = next((i + 1 for i, (nid, _) in enumerate(sorted_cent) if nid == entity_id), 0)

        return {
            "degree": degree,
            "betweenness": round(betweenness, 4),
            "centrality_score": round(centrality.get(entity_id, 0), 4),
            "centrality_rank": rank,
            "total_entities": total,
            "cluster_count": cluster_count,
            "largest_cluster_size": largest_cluster_size,
            "is_hub": degree >= 4,
            "is_bridge": betweenness > 0.2,
            "connected_entity_count": len(neighbors),
            "person_count": type_counts["Person"],
            "organization_count": type_counts["Organization"],
            "location_count": type_counts["Location"],
            "phone_count": type_counts["Phone"],
            "vehicle_count": type_counts["Vehicle"],
        }

    def calculate_review_score(self, entity_id: str, related_case_count: int = 0) -> dict:
        empty = {
            "label": "Network Risk Indicator",
            "score": 0,
            "severity": "low",
            "explanation": "Entity not present in the network",
            "factors": [],
            "disclaimer": self.REVIEW_DISCLAIMER,
        }
        if entity_id not in self.graph or len(self.graph) == 0:
            return empty

        degree = self.graph.degree(entity_id)
        undirected = self.graph.to_undirected()

        try:
            betweenness = nx.betweenness_centrality(undirected).get(entity_id, 0)
        except Exception:
            betweenness = 0

        try:
            communities = self.detect_communities()
        except Exception:
            communities = []

        neighbors = set(list(self.graph.neighbors(entity_id)) + list(self.graph.predecessors(entity_id)))
        org_count = 0
        loc_count = 0
        for nid in neighbors:
            ntype = self.graph.nodes[nid].get("entity_type", "")
            if ntype == "Organization":
                org_count += 1
            elif ntype == "Location":
                loc_count += 1

        cluster_size = max((len(c) for c in communities if entity_id in c), default=0)

        factors = []
        total = 0

        # 1. Case appearances
        if related_case_count >= 4:
            factors.append({"label": "Case appearances", "detail": f"Appears in {related_case_count} registered cases", "points": 30})
            total += 30
        elif related_case_count == 3:
            factors.append({"label": "Case appearances", "detail": f"Appears in {related_case_count} registered cases", "points": 25})
            total += 25
        elif related_case_count == 2:
            factors.append({"label": "Case appearances", "detail": "Appears in 2 registered cases", "points": 20})
            total += 20
        elif related_case_count == 1:
            factors.append({"label": "Case appearances", "detail": "Listed in 1 registered case", "points": 10})
            total += 10

        # 2. Connectivity (degree)
        if degree >= 10:
            factors.append({"label": "High connectivity", "detail": f"Connected to {degree} entities", "points": 30})
            total += 30
        elif degree >= 6:
            factors.append({"label": "High connectivity", "detail": f"Connected to {degree} entities", "points": 25})
            total += 25
        elif degree >= 4:
            factors.append({"label": "Moderate connectivity", "detail": f"Connected to {degree} entities", "points": 18})
            total += 18
        elif degree >= 2:
            factors.append({"label": "Low connectivity", "detail": f"Connected to {degree} entities", "points": 8})
            total += 8

        # 3. Organization links
        if org_count >= 2:
            factors.append({"label": "Multiple organization links", "detail": f"Connected to {org_count} organizations", "points": 15})
            total += 15
        elif org_count == 1:
            factors.append({"label": "Organization link", "detail": "Connected to 1 organization", "points": 8})
            total += 8

        # 4. Multiple location links
        if loc_count >= 2:
            factors.append({"label": "Multiple location links", "detail": f"Connected to {loc_count} locations", "points": 10})
            total += 10

        # 5. Bridge position
        if betweenness > 0.2:
            factors.append({"label": "Bridge position", "detail": f"Connects different network groups (betweenness {betweenness:.2f})", "points": 12})
            total += 12
        elif betweenness > 0.1:
            factors.append({"label": "Partial bridge position", "detail": f"Moderate betweenness {betweenness:.2f}", "points": 8})
            total += 8

        # 6. Cluster membership
        if cluster_size >= 3:
            factors.append({"label": "Cluster membership", "detail": f"Part of a cluster of {cluster_size} entities", "points": 5})
            total += 5

        total = min(total, 100)

        severity = "low"
        if total >= 60:
            severity = "high"
        elif total >= 30:
            severity = "medium"

        explanation = "; ".join(f["detail"] for f in factors) if factors else "Minimal network indicators"

        return {
            "label": "Network Risk Indicator",
            "score": total,
            "severity": severity,
            "explanation": explanation,
            "factors": factors,
            "disclaimer": self.REVIEW_DISCLAIMER,
        }

    def find_paths(self, source_id: str, target_id: str, max_length: int = 6) -> List[Dict]:
        if source_id not in self.graph or target_id not in self.graph:
            return []

        undirected = self.graph.to_undirected()
        try:
            paths = list(nx.all_simple_paths(undirected, source_id, target_id, cutoff=max_length))
        except Exception:
            paths = []

        results = []
        for path in paths[:5]:
            path_entities = []
            for node_id in path:
                if node_id in self.graph:
                    node_data = dict(self.graph.nodes[node_id])
                    path_entities.append(node_data)

            path_relationships = []
            for i in range(len(path) - 1):
                if self.graph.has_edge(path[i], path[i+1]):
                    rel_data = dict(self.graph.edges[path[i], path[i+1]])
                    path_relationships.append(rel_data)

            results.append({
                "entities": path_entities,
                "relationships": path_relationships,
                "length": len(path) - 1
            })

        return results


network_service = NetworkAnalysisService()
