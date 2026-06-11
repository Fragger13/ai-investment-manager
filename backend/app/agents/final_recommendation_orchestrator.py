from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.agents.recommendation_consensus_agent import build_recommendation_consensus
from app.agents.recommendation_fusion_agent import fuse_recommendation_set
from app.agents.goal_impact_agent import attach_goal_impacts
from app.agents.recommendation_orchestrator_agent import generate_institutional_recommendations
from app.agents.recommendation_priority_engine import prioritize_recommendations
from app.agents.master_orchestrator_agent import consolidate_recommendation_response
from app.schemas.financial import OnboardingProfile


ORCHESTRATED_LAYERS = [
    "User Intelligence",
    "Market Intelligence",
    "Asset Intelligence",
    "Validation Intelligence",
    "Portfolio Intelligence",
    "Adaptive Intelligence",
    "Explainability Intelligence",
]


def generate_final_recommendations(db: Session, profile: OnboardingProfile | None = None) -> dict[str, Any]:
    base = generate_institutional_recommendations(db, profile)
    recommendations = base.get("recommendations", [])
    fused, fusion_summary = fuse_recommendation_set(recommendations)
    committee_ready = []
    for recommendation in fused:
        item = dict(recommendation)
        consensus = build_recommendation_consensus(item)
        item["consensus"] = consensus
        item["committeeSupport"] = consensus["supportedLayers"]
        item["intelligenceLayerSupport"] = consensus["layerSupport"]
        item["convictionScore"] = max(item.get("convictionScore", 0), consensus["finalConviction"])
        item["evidenceScore"] = max(item.get("evidenceScore", 0), consensus["finalEvidenceScore"])
        item["institutionalRationale"] = _rationale(item, consensus)
        committee_ready.append(item)

    prioritized = [attach_goal_impacts(item) for item in prioritize_recommendations(committee_ready)]
    base["recommendations"] = prioritized
    base["finalOrchestration"] = {
        "orchestrator": "FinalRecommendationOrchestrator",
        "fusion": fusion_summary,
        "layers": ORCHESTRATED_LAYERS,
        "agentSequence": [
            "RecommendationOrchestratorAgent",
            "RecommendationFusionAgent",
            "RecommendationConsensusAgent",
            "RecommendationPriorityEngine",
            "MasterOrchestratorAgent",
        ],
        "principle": "Evidence-backed, risk-adjusted, goal-aware recommendations. No return guarantees.",
    }
    result = consolidate_recommendation_response(base)
    result["orchestrationVersion"] = "phase-final-multi-agent-fusion"
    result["finalOrchestration"] = base["finalOrchestration"]
    return result


def _rationale(recommendation: dict[str, Any], consensus: dict[str, Any]) -> str:
    layer_text = ", ".join(consensus.get("supportedLayers", [])[:5]) or "limited intelligence layers"
    goal = recommendation.get("goalTag") or (recommendation.get("linkedGoals") or [{}])[0].get("name", "your saved goals")
    return (
        f"This idea is ranked by an investment-committee style fusion of {layer_text}. "
        f"It supports {goal}, has {consensus.get('finalEvidenceScore', 0)}% evidence strength, "
        f"and remains capped because market outcomes are uncertain."
    )
