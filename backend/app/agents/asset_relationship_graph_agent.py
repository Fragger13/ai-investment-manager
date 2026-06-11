from __future__ import annotations


def relationship_explanation(asset_name: str, graph: dict) -> list[str]:
    asset_id = f"asset:{asset_name}"
    explanations = []
    for edge in graph.get("edges", []):
        if edge.get("source") == asset_id and edge.get("relationship") == "BELONGS_TO":
            explanations.append(f"Asset belongs to {edge['target'].replace('sector:', '')}, so sector and macro signals are relevant.")
        if edge.get("target") == asset_id:
            explanations.append(f"Related graph link: {edge.get('relationship')} from {edge.get('source')}.")
    return explanations[:3]


def related_recommendation_candidates(asset_name: str, graph: dict) -> list[str]:
    target_sector = None
    for edge in graph.get("edges", []):
        if edge.get("source") == f"asset:{asset_name}" and edge.get("relationship") == "BELONGS_TO":
            target_sector = edge.get("target")
            break
    if not target_sector:
        return []
    related = []
    for edge in graph.get("edges", []):
        if edge.get("target") == target_sector and edge.get("relationship") == "BELONGS_TO":
            related.append(edge.get("source", "").replace("asset:", ""))
    return [item for item in related if item and item != asset_name][:5]
