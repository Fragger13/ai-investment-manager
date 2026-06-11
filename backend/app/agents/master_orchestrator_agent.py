from __future__ import annotations

from typing import Any

from app.agents.conflict_resolution_agent import resolve_recommendation_conflicts
from app.agents.intelligence_compression_agent import compress_response_payload
from app.agents.recommendation_consolidation_agent import consolidate_recommendations
from app.agents.recommendation_quality_audit_agent import audit_recommendation_quality


def consolidate_recommendation_response(result: dict[str, Any]) -> dict[str, Any]:
    recommendations = result.get("recommendations", [])
    audited, audit_summary = audit_recommendation_quality(recommendations)
    resolved, conflict_summary = resolve_recommendation_conflicts(audited)
    consolidated, consolidation_summary = consolidate_recommendations(resolved)
    result = compress_response_payload(result)
    result["recommendations"] = consolidated
    result["recommendationGroups"] = consolidation_summary["groups"]
    result["consolidationSummary"] = {
        **consolidation_summary,
        "qualityAudit": audit_summary,
        "conflictResolution": conflict_summary,
    }
    result["orchestrationVersion"] = "phase-7h-consolidated"
    return result
