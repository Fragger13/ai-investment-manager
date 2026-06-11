from __future__ import annotations


def build_investment_knowledge_graph(goals: list[dict], assets: list, signals: list[dict]) -> dict:
    nodes = []
    edges = []
    for goal in goals:
        goal_id = f"goal:{goal['name']}"
        nodes.append({"id": goal_id, "type": "Goal", "label": goal["name"]})
        for key in goal.get("eligibleAssetKeys", []):
            asset_class_id = f"asset_class:{key}"
            nodes.append({"id": asset_class_id, "type": "AssetClass", "label": key})
            edges.append({"source": goal_id, "relationship": "SUPPORTED_BY", "target": asset_class_id})
    for asset in assets:
        asset_id = f"asset:{asset.instrument_name}"
        sector = _sector_for(asset.instrument_name, asset.category)
        nodes.append({"id": asset_id, "type": "Asset", "label": asset.instrument_name})
        nodes.append({"id": f"sector:{sector}", "type": "Sector", "label": sector})
        edges.append({"source": asset_id, "relationship": "BELONGS_TO", "target": f"sector:{sector}"})
    for signal in signals[:60]:
        signal_id = f"signal:{signal.get('id', signal.get('sourceUrl', 'unknown'))}"
        nodes.append({"id": signal_id, "type": "MarketSignal", "label": signal.get("title", signal.get("summary", "")[:80])})
        for sector in signal.get("sectors", []):
            edges.append({"source": signal_id, "relationship": "AFFECTS", "target": f"sector:{sector}"})
    return {"nodes": _dedupe(nodes), "edges": edges}


def _sector_for(name: str, category: str) -> str:
    text = f"{name} {category}".lower()
    if "bank" in text:
        return "banking"
    if "it" in text or "infosys" in text or "software" in text:
        return "IT"
    if "defence" in text or "electronics" in text:
        return "defence/electronics"
    if "infra" in text or "larsen" in text:
        return "capital goods"
    if "gold" in text:
        return "gold"
    if "crypto" in text or name.lower() in {"bitcoin", "ethereum", "solana", "chainlink"}:
        return "crypto"
    return "broad market"


def _dedupe(nodes: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for node in nodes:
        if node["id"] in seen:
            continue
        seen.add(node["id"])
        unique.append(node)
    return unique
