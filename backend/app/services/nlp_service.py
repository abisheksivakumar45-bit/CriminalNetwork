import re
import spacy
from typing import List, Dict, Tuple
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import SPACY_MODEL


class NLPService:
    def __init__(self):
        self.nlp = None
        self._load_model()

    def _load_model(self):
        try:
            self.nlp = spacy.load(SPACY_MODEL)
        except OSError:
            print(f"spaCy model '{SPACY_MODEL}' not found. Installing...")
            import subprocess
            subprocess.check_call([sys.executable, "-m", "spacy", "download", SPACY_MODEL])
            self.nlp = spacy.load(SPACY_MODEL)

    def extract_entities(self, text: str) -> List[Dict]:
        if not self.nlp:
            return self._rule_based_extraction(text)

        doc = self.nlp(text)
        entities = []

        # spaCy NER extraction
        for ent in doc.ents:
            entity_type = self._map_spacy_label(ent.label_)
            if entity_type:
                entities.append({
                    "name": ent.text.strip(),
                    "entity_type": entity_type,
                    "source": "spacy_ner",
                    "confidence": 0.8
                })

        # Rule-based extraction for domain-specific patterns
        rule_entities = self._rule_based_extraction(text)
        entities.extend(rule_entities)

        # Deduplicate
        seen = set()
        unique = []
        for e in entities:
            key = (e["name"].lower(), e["entity_type"])
            if key not in seen:
                seen.add(key)
                unique.append(e)

        return unique

    def _map_spacy_label(self, label: str) -> str:
        mapping = {
            "PERSON": "Person",
            "ORG": "Organization",
            "GPE": "Location",
            "LOC": "Location",
            "DATE": None,
            "TIME": None,
            "MONEY": None,
            "CARDINAL": None,
            "NORP": "Organization",
            "FAC": "Location",
        }
        return mapping.get(label)

    def _rule_based_extraction(self, text: str) -> List[Dict]:
        entities = []

        # Phone numbers (Indian format)
        phone_pattern = r'(?:\+91[-\s]?)?[6-9]\d{9}|(?:\+91[-\s]?)?\d{10}'
        phones = re.findall(phone_pattern, text)
        for phone in phones:
            clean = re.sub(r'[\s\-]', '', phone)
            if len(clean) >= 10:
                entities.append({
                    "name": clean,
                    "entity_type": "Phone",
                    "source": "regex",
                    "confidence": 0.9
                })

        # Vehicle numbers (Indian format)
        vehicle_pattern = r'[A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{4}'
        vehicles = re.findall(vehicle_pattern, text.upper())
        for v in vehicles:
            entities.append({
                "name": v.strip(),
                "entity_type": "Vehicle",
                "source": "regex",
                "confidence": 0.95
            })

        # Case/FIR numbers
        fir_pattern = r'(?:FIR|Case|CC)\s*(?:No\.?|Number)?\s*:?\s*(\d+[/\-]?\d*)'
        firs = re.findall(fir_pattern, text, re.IGNORECASE)
        for f in firs:
            entities.append({
                "name": f"Case-{f}",
                "entity_type": "Case",
                "source": "regex",
                "confidence": 0.9
            })

        # Named persons from common Indian names patterns (fallback)
        name_patterns = [
            r'(?:accused|suspect|victim|witness|informant|arrested)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',
            r'(?:Mr|Mrs|Ms|Shri|Smt)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',
        ]
        for pattern in name_patterns:
            matches = re.findall(pattern, text)
            for name in matches:
                if len(name.split()) >= 2:
                    entities.append({
                        "name": name.strip(),
                        "entity_type": "Person",
                        "source": "regex_pattern",
                        "confidence": 0.7
                    })

        # Organization patterns
        org_patterns = [
            r'(?:company|firm|organization|group|syndicate|gang|network)\s+([A-Z][\w\s&]{2,30})',
            r'([A-Z][\w\s&]{2,30})\s+(?:Ltd|Pvt|Inc|Corp|LLP|Group|Syndicate)',
        ]
        for pattern in org_patterns:
            matches = re.findall(pattern, text)
            for org in matches:
                entities.append({
                    "name": org.strip(),
                    "entity_type": "Organization",
                    "source": "regex_pattern",
                    "confidence": 0.6
                })

        return entities

    def extract_relationships(self, text: str, entities: List[Dict]) -> List[Dict]:
        relationships = []
        entity_names = {e["name"].lower(): e for e in entities}

        # Co-occurrence based relationships
        sentences = re.split(r'[.!?]+', text)
        for sentence in sentences:
            sentence_entities = []
            for name, entity in entity_names.items():
                if name in sentence.lower():
                    sentence_entities.append(entity)

            # Create relationships between co-occurring entities
            for i in range(len(sentence_entities)):
                for j in range(i + 1, len(sentence_entities)):
                    e1 = sentence_entities[i]
                    e2 = sentence_entities[j]
                    rel_type = self._infer_relationship_type(e1["entity_type"], e2["entity_type"], sentence)
                    relationships.append({
                        "source": e1["name"],
                        "target": e2["name"],
                        "relationship_type": rel_type,
                        "context": sentence.strip()[:200],
                        "confidence": 0.6
                    })

        # Deduplicate relationships
        seen = set()
        unique = []
        for r in relationships:
            key = (r["source"].lower(), r["target"].lower(), r["relationship_type"])
            if key not in seen:
                seen.add(key)
                unique.append(r)

        return unique

    def _infer_relationship_type(self, type1: str, type2: str, context: str) -> str:
        context_lower = context.lower()

        if type1 == "Person" and type2 == "Person":
            if any(w in context_lower for w in ["gang", "network", "syndicate", "group"]):
                return "ASSOCIATED_WITH"
            if any(w in context_lower for w in ["call", "contact", "met", "spoke"]):
                return "CONTACTED"
            return "ASSOCIATED_WITH"

        if type1 == "Person" and type2 == "Phone":
            return "USES"
        if type2 == "Person" and type1 == "Phone":
            return "USES"
        if type1 == "Person" and type2 == "Vehicle":
            return "OWNS"
        if type2 == "Person" and type1 == "Vehicle":
            return "OWNS"
        if type1 == "Person" and type2 == "Location":
            return "LOCATED_AT"
        if type2 == "Person" and type1 == "Location":
            return "LOCATED_AT"
        if type1 == "Person" and type2 == "Organization":
            return "MEMBER_OF"
        if type2 == "Person" and type1 == "Organization":
            return "MEMBER_OF"
        if type1 == "Person" and type2 == "Case":
            return "SUSPECTED_IN"
        if type2 == "Person" and type1 == "Case":
            return "SUSPECTED_IN"

        return "ASSOCIATED_WITH"


nlp_service = NLPService()
