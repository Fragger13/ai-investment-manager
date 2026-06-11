from __future__ import annotations

import json
from hashlib import sha1
from typing import Any

from sqlalchemy.orm import Session

from app.agents.contradiction_analysis_agent import analyze_recommendation_contradictions
from app.agents.evidence_summarization_agent import summarize_recommendation_evidence
from app.agents.reasoning_chain_agent import build_reasoning_chain
from app.agents.recommendation_invalidation_agent import build_invalidation_rules
from app.agents.thesis_validation_agent import validate_recommendation_thesis
from app.agents.uncertainty_analysis_agent import analyze_recommendation_uncertainty
from app.models.confidence_breakdown import ConfidenceBreakdown
from app.models.reasoning_chain import ReasoningChain
from app.models.recommendation_contradiction import RecommendationContradiction
from app.models.recommendation_invalidation_rule import RecommendationInvalidationRule
from app.models.recommendation_reasoning import RecommendationReasoning
from app.models.recommendation_uncertainty import RecommendationUncertainty
from app.services.intelligence import now_iso
from app.core.config import settings
from app.services.llm.model_router import refine_recommendation_explainability


def enrich_recommendation_explainability(db: Session | None, recommendation: dict[str, Any], llm_enhance: bool = True) -> dict[str, Any]:
    explanation = build_recommendation_explainability(recommendation, llm_enhance=llm_enhance)
    recommendation.update(explanation)
    if db is not None:
        persist_recommendation_explainability(db, recommendation)
    return recommendation


def build_recommendation_explainability(recommendation: dict[str, Any], llm_enhance: bool = True) -> dict[str, Any]:
    evidence_summary = summarize_recommendation_evidence(recommendation)
    contradiction_analysis = analyze_recommendation_contradictions(recommendation, evidence_summary)
    uncertainty_analysis = analyze_recommendation_uncertainty(recommendation, contradiction_analysis)
    invalidation_rules = build_invalidation_rules(recommendation)
    thesis_validation = validate_recommendation_thesis(recommendation, contradiction_analysis, uncertainty_analysis)
    confidence_breakdown = _confidence_breakdown(recommendation, contradiction_analysis)
    reasoning = _reasoning(recommendation, thesis_validation)
    reasoning_chain = build_reasoning_chain(
        recommendation,
        evidence_summary,
        contradiction_analysis,
        uncertainty_analysis,
        invalidation_rules,
    )
    labels = _trust_labels(recommendation, contradiction_analysis, uncertainty_analysis, confidence_breakdown)
    explanation_payload = _explanation_payload(recommendation, reasoning, evidence_summary, contradiction_analysis, uncertainty_analysis, invalidation_rules, llm_enhance=llm_enhance)
    return {
        "recommendationReasoning": reasoning,
        "reasoningChain": reasoning_chain,
        "evidenceSummary": evidence_summary,
        "contradictionAnalysis": contradiction_analysis,
        "uncertaintyAnalysis": uncertainty_analysis,
        "invalidationRules": invalidation_rules,
        "confidenceBreakdown": confidence_breakdown,
        "thesisValidation": thesis_validation,
        "explanationCards": explanation_payload["explanationCards"],
        "explanation_cards": explanation_payload["explanation_cards"],
        "advancedAnalysis": explanation_payload["advancedAnalysis"],
        "advanced_analysis": explanation_payload["advanced_analysis"],
        "fullResearchSummary": explanation_payload["fullResearchSummary"],
        "full_research_summary": explanation_payload["full_research_summary"],
        "llm_enhanced": explanation_payload["llm_enhanced"],
        "llm_provider": explanation_payload["llm_provider"],
        "llm_model": explanation_payload["llm_model"],
        "llm_generated_at": explanation_payload["llm_generated_at"],
        "llm_fallback_reason": explanation_payload["llm_fallback_reason"],
        "llmEnhanced": explanation_payload["llmEnhanced"],
        "llmProvider": explanation_payload["llmProvider"],
        "llmModel": explanation_payload["llmModel"],
        "llmGeneratedAt": explanation_payload["llmGeneratedAt"],
        "llmFallbackReason": explanation_payload["llmFallbackReason"],
        "trustLabels": labels,
        "explainabilityGeneratedAt": now_iso(),
    }


def build_market_signal_explainability(signal: dict[str, Any]) -> dict[str, Any]:
    contradictions = signal.get("conflictingEvidence") or signal.get("impactMap", {}).get("contradictionLinks", []) or []
    reliability = signal.get("historicalReliability", 0)
    confidence = signal.get("confidenceScore", 0)
    impact = signal.get("impactScore", confidence)
    contradiction_penalty = min(35, len(contradictions) * 8 + signal.get("contradictionScore", 0) // 5)
    components = [
        _component("Source quality", signal.get("credibilityScore", confidence), "How dependable the source behind this update appears to be."),
        _component("Strength of this update", confidence, "How clearly the available information supports this update."),
        _component("Possible effect", impact, "How much this could affect related areas and investments."),
        _component("How similar past updates behaved", reliability, "How similar updates behaved in the past."),
        _component("Fit with current market conditions", signal.get("regimeRelevance", 0), "How well this fits what is happening in markets today."),
        _component("Cautionary information", 100 - contradiction_penalty, "A higher score means fewer concerns were found."),
    ]
    beneficiaries = signal.get("likelyBeneficiaries", [])
    losers = signal.get("likelyLosers", [])
    why_matters = signal.get("whyItMatters") or signal.get("summary", "")
    explainability = {
        "whySignalMatters": why_matters,
        "beneficiaryRationale": _market_rationale("benefit", beneficiaries, signal),
        "loserRationale": _market_rationale("face pressure", losers, signal),
        "confidenceExplanation": _market_confidence_explanation(components, contradictions),
        "contradictionExplanation": _market_contradiction_explanation(contradictions),
        "regimeDependence": "This update is more useful when it fits current market conditions and becomes less useful if those conditions change.",
        "historicalReliability": reliability,
    }
    return {
        "explainability": explainability,
        "confidenceBreakdown": {
            "overall": confidence,
            "components": components,
            "contradictionPenalty": contradiction_penalty,
            "explanation": _market_confidence_explanation(components, contradictions),
        },
        "contradictionSummary": _market_contradiction_explanation(contradictions),
        "uncertaintySummary": _market_uncertainty_summary(signal, contradictions),
    }


def persist_recommendation_explainability(db: Session, recommendation: dict[str, Any]) -> None:
    key = _recommendation_key(recommendation)
    created_at = recommendation.get("explainabilityGeneratedAt") or now_iso()
    reasoning = recommendation.get("recommendationReasoning", {})
    db.add(
        RecommendationReasoning(
            recommendation_key=key,
            instrument_name=recommendation.get("instrumentName", ""),
            why_recommended=reasoning.get("whyRecommended", ""),
            why_now=reasoning.get("whyNow", ""),
            reasoning_json=json.dumps(reasoning),
            model_version=recommendation.get("modelVersion", ""),
            created_at=created_at,
        )
    )
    db.add(
        ConfidenceBreakdown(
            recommendation_key=key,
            instrument_name=recommendation.get("instrumentName", ""),
            overall_confidence=recommendation.get("confidenceScore", 0),
            breakdown_json=json.dumps(recommendation.get("confidenceBreakdown", {})),
            explanation=recommendation.get("confidenceBreakdown", {}).get("explanation", ""),
            created_at=created_at,
        )
    )
    db.add(
        ReasoningChain(
            recommendation_key=key,
            instrument_name=recommendation.get("instrumentName", ""),
            chain_json=json.dumps(recommendation.get("reasoningChain", [])),
            final_summary=reasoning.get("summary", ""),
            created_at=created_at,
        )
    )
    for item in recommendation.get("contradictionAnalysis", {}).get("items", [])[:8]:
        db.add(
            RecommendationContradiction(
                recommendation_key=key,
                instrument_name=recommendation.get("instrumentName", ""),
                contradiction_type=item.get("type", ""),
                severity=item.get("severity", "medium"),
                summary=item.get("summary", ""),
                evidence_json=json.dumps(item),
                created_at=created_at,
            )
        )
    for item in recommendation.get("uncertaintyAnalysis", {}).get("items", [])[:8]:
        db.add(
            RecommendationUncertainty(
                recommendation_key=key,
                instrument_name=recommendation.get("instrumentName", ""),
                uncertainty_type=item.get("type", ""),
                severity=item.get("severity", "medium"),
                summary=item.get("summary", ""),
                action_impact=item.get("actionImpact", ""),
                created_at=created_at,
            )
        )
    for item in recommendation.get("invalidationRules", [])[:8]:
        db.add(
            RecommendationInvalidationRule(
                recommendation_key=key,
                instrument_name=recommendation.get("instrumentName", ""),
                rule_type=item.get("type", ""),
                trigger=item.get("trigger", ""),
                severity=item.get("severity", "medium"),
                suggested_response=item.get("suggestedResponse", ""),
                created_at=created_at,
            )
        )
    db.commit()


def _market_rationale(action: str, values: list[str], signal: dict[str, Any]) -> str:
    if not values:
        return f"No clear investment or industry has been identified to {action} yet."
    driver = signal.get("shortTermImpact") or signal.get("whyItMatters") or signal.get("summary", "")
    return f"{', '.join(values[:4])} may {action} because this market update points to {driver[:160]}."


def _market_confidence_explanation(components: list[dict[str, Any]], contradictions: list[dict[str, Any]]) -> str:
    weak = [item["label"] for item in components if item["score"] < 50]
    if contradictions:
        return "Confidence is limited because some information points in a different direction."
    if weak:
        return f"Confidence is limited by {', '.join(weak[:3])}."
    return "Confidence combines source quality, the strength of the update, its possible effect, and how well it fits current market conditions."


def _market_contradiction_explanation(contradictions: list[dict[str, Any]]) -> str:
    if not contradictions:
        return "No directly linked concern has been recorded for this update."
    first = contradictions[0]
    return first.get("summary") or f"{len(contradictions)} cautionary item(s) are linked."


def _market_uncertainty_summary(signal: dict[str, Any], contradictions: list[dict[str, Any]]) -> str:
    if signal.get("dataMode") in {"limited", "fallback"}:
        return "There is extra uncertainty because the available information is limited."
    if signal.get("historicalReliability", 0) < 45:
        return "There is extra uncertainty because similar past updates have not been checked recently or did not behave consistently."
    if contradictions:
        return "There is some uncertainty because the available information points in different directions."
    return "Market updates always involve uncertainty. This is useful context, not a prediction."


def _reasoning(recommendation: dict[str, Any], thesis_validation: dict[str, Any]) -> dict[str, Any]:
    goal = recommendation.get("linkedGoals", [{}])[0] if recommendation.get("linkedGoals") else {}
    goal_name = goal.get("name") or recommendation.get("goalTag") or "your main goals"
    goal_priority = goal.get("priority") or recommendation.get("goalPriority") or recommendation.get("priorityOrder")
    goal_priority_text = goal_priority if goal_priority is not None else "saved"
    horizon = recommendation.get("timeHorizon") or recommendation.get("longTermHorizon") or "your stated time horizon"
    regime = recommendation.get("marketRegime") or "current market"
    asset = recommendation.get("instrumentName") or recommendation.get("assetName") or "this asset"
    why_recommended = _specific_why_recommended(recommendation, asset, goal_name, goal_priority_text, horizon)
    why_now = _specific_why_now(recommendation, asset, regime)
    allocation = (
        f"The suggested share is {recommendation.get('suggestedAllocationPercentage', 0)}%, limited to "
        f"{recommendation.get('strictAllocationCap') or recommendation.get('allocationCap') or recommendation.get('suggestedAllocationPercentage', 0)}% "
        f"because risk level is {recommendation.get('riskLevel', 'Medium')}."
    )
    return {
        "summary": thesis_validation.get("summary", ""),
        "whyRecommended": why_recommended,
        "whyNow": why_now,
        "allocationRationale": allocation,
        "goalRationale": f"Linked to priority {goal_priority_text} goal: {goal_name}. Time horizon considered: {horizon}.",
        "portfolioRationale": recommendation.get("allocationImpact") or recommendation.get("portfolioRole") or "The effect on your investments is estimated by comparing your current mix with your suggested mix.",
        "assumptions": thesis_validation.get("assumptions", []),
    }


def _confidence_breakdown(recommendation: dict[str, Any], contradiction_analysis: dict[str, Any]) -> dict[str, Any]:
    final = recommendation.get("finalScoreBreakdown", {}) or {}
    validation = recommendation.get("historicalValidation") or recommendation.get("validation") or {}
    components = [
        _component("Supporting information", recommendation.get("evidenceScore", recommendation.get("confidenceScore", 50)), "Quality, timing, and source support."),
        _component("How similar past ideas behaved", validation.get("historicalReliability", recommendation.get("validationScore", 0)), "How similar ideas behaved in the past."),
        _component("Fit with current market conditions", final.get("marketRegimeFitScore", recommendation.get("confidenceScore", 50)), "How well this fits what is happening in markets today."),
        _component("Price-trend quality", recommendation.get("technicalScore", final.get("technicalTimingScore", 0)), "What recent price and trading activity suggest."),
        _component("Investment quality", recommendation.get("fundamentalScore", final.get("fundamentalQualityScore", 0)), "Business, fund, or investment quality where information is available."),
        _component("Support from wider market conditions", max(final.get("marketRegimeFitScore", 0), 65 if recommendation.get("keyTrigger") else 45), "Support from wider market, policy, or sector changes."),
        _component("Support from recent market mood", _sentiment_score(recommendation), "What recent news and market updates suggest."),
        _component("Ease of buying and selling", _liquidity_confidence(final), "How easily this investment can be bought or sold."),
        _component("Cautionary information", 100 - contradiction_analysis.get("contradictionPenalty", 0), "A higher score means fewer concerns were found."),
    ]
    return {
        "overall": recommendation.get("confidenceScore", 0),
        "components": components,
        "contradictionPenalty": contradiction_analysis.get("contradictionPenalty", 0),
        "explanation": _confidence_explanation(recommendation, components, contradiction_analysis),
    }


def _component(label: str, value: Any, explanation: str) -> dict[str, Any]:
    score = _clamp(value)
    tone = "good" if score >= 70 else "warn" if score >= 45 else "danger"
    return {"label": label, "score": score, "tone": tone, "explanation": explanation}


def _sentiment_score(recommendation: dict[str, Any]) -> int:
    sentiment = recommendation.get("sentimentSignal") or {}
    if sentiment.get("sentimentScore") is not None:
        return _clamp(sentiment["sentimentScore"])
    supporting = len(recommendation.get("supportingSignals", []))
    conflicting = len(recommendation.get("contradictorySignals", []))
    return _clamp(55 + supporting * 5 - conflicting * 8)


def _liquidity_confidence(final: dict[str, Any]) -> int:
    penalty = final.get("liquidityPenalty", 0)
    return _clamp(85 - penalty)


def _confidence_explanation(recommendation: dict[str, Any], components: list[dict[str, Any]], contradiction_analysis: dict[str, Any]) -> str:
    weak = [item["label"] for item in components if item["score"] < 50]
    if weak:
        return f"Confidence is below perfect because {', '.join(weak[:3])} need review."
    if contradiction_analysis.get("contradictionCount", 0):
        return "Confidence is limited because some information points in a different direction."
    return "Confidence is based on supporting information, your situation, similar past ideas, and current market conditions. It is not a promise of returns."


def _explanation_payload(
    recommendation: dict[str, Any],
    reasoning: dict[str, Any],
    evidence_summary: dict[str, Any],
    contradiction_analysis: dict[str, Any],
    uncertainty_analysis: dict[str, Any],
    invalidation_rules: list[dict[str, Any]],
    llm_enhance: bool = True,
) -> list[dict[str, str]]:
    support = _support_card_summary(recommendation, evidence_summary)
    risk = _risk_card_summary(recommendation, contradiction_analysis, invalidation_rules)
    action = _action_card_summary(recommendation)
    fallback_cards = [
        {"title": "Why am I seeing this?", "summary": _ui_sentence(reasoning.get("whyRecommended"), _fallback_why_recommended(recommendation)), "tone": "good"},
        {"title": "Why could this be a good time?", "summary": _ui_sentence(reasoning.get("whyNow"), _fallback_why_now(recommendation)), "tone": "neutral"},
        {"title": "What makes this promising?", "summary": _ui_sentence(support, "Supporting information is limited, so keep this idea small."), "tone": "good" if recommendation.get("evidenceScore", recommendation.get("confidenceScore", 0)) >= 70 else "warn"},
        {"title": "What should I be careful about?", "summary": _ui_sentence(risk, "Markets can change. Review this idea if the supporting information becomes weaker."), "tone": "warn" if contradiction_analysis.get("contradictionCount") else "neutral"},
        {"title": "What should I do next?", "summary": _ui_sentence(action, "Consider acting gradually, keep the amount limited, and review it on schedule."), "tone": "warn" if _is_watchlist(recommendation) else "good"},
    ]
    fallback_payload = {
        "explanationCards": fallback_cards,
        "explanation_cards": _snake_cards(fallback_cards),
        "advancedAnalysis": _advanced_analysis_summary(recommendation, evidence_summary, contradiction_analysis, invalidation_rules),
        "advanced_analysis": _advanced_analysis_summary(recommendation, evidence_summary, contradiction_analysis, invalidation_rules),
        "fullResearchSummary": _full_research_summary(recommendation, evidence_summary, contradiction_analysis),
        "full_research_summary": _full_research_summary(recommendation, evidence_summary, contradiction_analysis),
        **_llm_metadata(False, "not_requested"),
    }
    if not llm_enhance:
        return fallback_payload
    return refine_recommendation_explainability(recommendation, fallback_payload)


def _snake_cards(cards: list[dict[str, str]]) -> list[dict[str, str]]:
    icons = {
        "Why am I seeing this?": "target",
        "Why could this be a good time?": "clock",
        "What makes this promising?": "check-circle",
        "What should I be careful about?": "alert-triangle",
        "What should I do next?": "compass",
    }
    return [{"question": item["title"], "answer": item["summary"], "icon": icons.get(item["title"], "info"), "tone": item.get("tone", "neutral")} for item in cards]


def _advanced_analysis_summary(recommendation: dict[str, Any], evidence_summary: dict[str, Any], contradiction_analysis: dict[str, Any], invalidation_rules: list[dict[str, Any]]) -> str:
    top = (evidence_summary.get("topSupportingEvidence") or [{}])[0]
    trigger = invalidation_rules[0].get("trigger") if invalidation_rules else recommendation.get("invalidationTrigger") or "review if evidence weakens"
    points = [
        f"Main supporting signal: {top.get('summary') or recommendation.get('keyTrigger') or 'Supporting information is limited.'}",
        f"Top risk: {recommendation.get('primaryRisk') or recommendation.get('whatCanGoWrong') or 'Market risk can affect outcomes.'}",
        f"Current market conditions: {recommendation.get('marketRegimeSummary') or recommendation.get('marketRegime') or 'Information about current market conditions is limited.'}",
        f"What could challenge this idea: {contradiction_analysis.get('summary') or 'No direct concern is stored yet.'}",
        f"Review this idea if: {trigger}",
    ]
    return " ".join(_ui_sentence(point, "Limited validated data available.", 180) for point in points)


def _full_research_summary(recommendation: dict[str, Any], evidence_summary: dict[str, Any], contradiction_analysis: dict[str, Any]) -> str:
    asset = recommendation.get("instrumentName") or "This recommendation"
    evidence = evidence_summary.get("supportSummary") or "Supporting information is limited."
    contradiction = contradiction_analysis.get("summary") or "No major source-backed concern is stored yet."
    risk = recommendation.get("primaryRisk") or recommendation.get("whatCanGoWrong") or "Market conditions can change."
    return _ui_sentence(f"{asset}: {evidence} Main risk: {risk} What could challenge this idea: {contradiction}", "A deeper summary is not available yet.", 520)


def _llm_metadata(enhanced: bool, reason: str | None) -> dict[str, Any]:
    return {
        "llm_enhanced": enhanced,
        "llm_provider": settings.llm_provider if settings.llm_enabled else "none",
        "llm_model": settings.llm_model_reasoning or settings.llm_model,
        "llm_generated_at": now_iso(),
        "llm_fallback_reason": None if enhanced else reason,
        "llmEnhanced": enhanced,
        "llmProvider": settings.llm_provider if settings.llm_enabled else "none",
        "llmModel": settings.llm_model_reasoning or settings.llm_model,
        "llmGeneratedAt": now_iso(),
        "llmFallbackReason": None if enhanced else reason,
    }


def _specific_why_recommended(recommendation: dict[str, Any], asset: str, goal_name: str, goal_priority: Any, horizon: str) -> str:
    role = recommendation.get("portfolioBucket") or recommendation.get("portfolioRole") or recommendation.get("strategyBucket") or "portfolio"
    allocation = recommendation.get("suggestedAllocationPercentage", 0)
    reason = recommendation.get("whyThisMatters") or recommendation.get("userSpecificReasoning") or ""
    asset_intelligence = recommendation.get("assetIntelligence") or {}
    goal_text = _goal_phrase(goal_name, goal_priority)
    goal = (recommendation.get("linkedGoals") or [{}])[0]
    months = goal.get("timeHorizonMonths") or recommendation.get("goalTimeHorizonMonths")
    funding_gap = goal.get("fundingGap") or recommendation.get("goalFundingGap")
    timeline = f" with {months} months remaining" if months else f" over {horizon}"
    gap = f" and an estimated funding gap of ₹{funding_gap:,.0f}" if isinstance(funding_gap, (int, float)) and funding_gap > 0 else ""
    if asset_intelligence:
        technical = asset_intelligence.get("technical", {})
        fundamental = asset_intelligence.get("fundamental", {})
        liquidity = asset_intelligence.get("liquidity", {})
        return (
            f"{asset} is a limited-size idea for {goal_text}{timeline}. Its price trend, investment quality, "
            f"and ease of buying or selling are being checked before the suggested {allocation}% limit is increased."
        )
    if "gold" in asset.lower():
        return f"{asset} may add stability for {goal_text}{timeline}. It is limited to {allocation}% so your plan does not depend too heavily on shares."
    if recommendation.get("assetType", "").lower().find("debt") >= 0 or "liquid" in asset.lower():
        return f"{asset} supports {goal_text}{timeline}{gap}. It keeps near-term money in an investment that is usually steadier than shares."
    if recommendation.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven"}:
        return f"{asset} is a small short-term idea for {goal_text}{timeline}. The amount stays limited because it should not take money away from important goals."
    return f"{asset} supports {goal_text}{timeline}{gap} and has a {role} role in your investment mix. {_brief(reason, 70)}"


def _goal_phrase(goal_name: str, goal_priority: Any) -> str:
    if goal_priority == "saved":
        return f"saved goal '{goal_name}'"
    return f"priority {goal_priority} goal '{goal_name}'"


def _specific_why_now(recommendation: dict[str, Any], asset: str, regime: str) -> str:
    trigger = recommendation.get("keyTrigger") or recommendation.get("conciseTrigger") or ""
    market = recommendation.get("marketRegimeSummary") or recommendation.get("currentMarketReasoning") or ""
    entry = _entry_phrase(recommendation.get("buyRange") or recommendation.get("entryApproach") or "staggered entry")
    asset_intelligence = recommendation.get("assetIntelligence") or {}
    validation = recommendation.get("historicalValidation") or recommendation.get("validation") or {}
    reliability = validation.get("historicalReliability") if isinstance(validation, dict) else None
    reliability_text = f" Similar past ideas scored {reliability}%." if isinstance(reliability, (int, float)) and reliability > 0 else ""
    if asset_intelligence:
        technical = asset_intelligence.get("technical", {})
        signal = trigger or technical.get("breakoutStatus") or technical.get("buyRange") or market
        return f"Current market conditions make timing important because {_reason_phrase(signal)}. Use {entry} and review the idea if supporting information weakens.{reliability_text}"
    if trigger:
        return f"Current market conditions matter because {_reason_phrase(trigger)}. Use {entry} instead of investing everything at once.{reliability_text}"
    if market:
        return f"Current market conditions influence timing for {asset}: {_brief(market, 120)}"
    return f"Timing is based on current market conditions, available supporting information, and the suggested {entry} approach."


def _support_card_summary(recommendation: dict[str, Any], evidence_summary: dict[str, Any]) -> str:
    top = (evidence_summary.get("topSupportingEvidence") or [None])[0]
    evidence_score = recommendation.get("evidenceScore", recommendation.get("confidenceScore", 0))
    technical = recommendation.get("technicalScore", 0)
    fundamental = recommendation.get("fundamentalScore", 0)
    if top:
        source = top.get("source", "research source")
        signal_type = top.get("signalType", "market evidence")
        if str(signal_type).lower() in {"supporting", "support"}:
            signal_type = "source-backed evidence"
        confidence = top.get("confidence", evidence_score)
        summary = top.get("summary", "")
        return _ui_sentence(
            f"{source} provides the strongest supporting information at {confidence}% confidence. The overall supporting-signal score is {evidence_score}%. {_brief(summary, 70)}",
            f"The supporting-signal score is {evidence_score}%, with limited source detail available.",
        )
    return _ui_sentence(
        f"Supporting information is limited for {recommendation.get('instrumentName', 'this asset')}, so confidence stays at {evidence_score}% until more useful sources are available.",
        "Supporting information is limited, so confidence stays lower until the information is refreshed.",
    )


def _risk_card_summary(recommendation: dict[str, Any], contradiction_analysis: dict[str, Any], invalidation_rules: list[dict[str, Any]]) -> str:
    risk = recommendation.get("primaryRisk") or recommendation.get("whatCanGoWrong") or recommendation.get("downsideScenario") or recommendation.get("riskExplanation")
    contradiction = contradiction_analysis.get("summary") or ""
    trigger = invalidation_rules[0].get("trigger") if invalidation_rules else recommendation.get("invalidationTrigger") or recommendation.get("exitOrRebalanceCondition")
    if _is_watchlist(recommendation):
        watch_reason = _human_quality_reason(recommendation.get("qualityGateFailures", []))
        return _ui_sentence(f"Keep an eye on this because {watch_reason}. Main risk: {_clause(risk, 80)}. Review if {_clause(trigger, 70)}.", "Keep an eye on this because the supporting information is not strong enough to suggest buying yet.")
    if contradiction_analysis.get("contradictionCount"):
        return _ui_sentence(f"Main risk: {_clause(risk, 80)}. A concern to consider: {_clause(contradiction, 70)}. Review if {_clause(trigger, 70)}.", "Some information points in a different direction, so keep the amount limited.")
    return _ui_sentence(f"Main risk: {_clause(risk, 100)}. Review if {_clause(trigger, 70)}.", "Markets can change, so review the idea if supporting information weakens.")


def _action_card_summary(recommendation: dict[str, Any]) -> str:
    action = recommendation.get("action") or "watchlist"
    allocation = recommendation.get("suggestedAllocationPercentage", recommendation.get("allocationPercent", 0))
    amount = recommendation.get("suggestedMonthlyAmount", recommendation.get("suggestedAmount", 0))
    review = recommendation.get("reviewDate") or recommendation.get("reviewCadence") or "the next portfolio review"
    cap = recommendation.get("strictAllocationCap") or recommendation.get("allocationCap") or allocation
    if _is_watchlist(recommendation):
        return _ui_sentence(f"Keep an eye on this idea. Review by {review}; do not go above {cap}% unless the supporting information improves and it remains easy to buy or sell.", "Keep an eye on this idea until the supporting information improves.")
    return _ui_sentence(f"Consider {action.lower()} with {allocation}% of your investments or ₹{amount:,}/month. Keep it near the {cap}% limit and review by {review}.", "Consider acting gradually, keep the amount limited, and review it on schedule.")


def _human_quality_reason(failures: list[str]) -> str:
    labels = {
        "weak_final_score_for_active_risk": "the overall risk-adjusted score is not strong enough for an active buy",
        "weak_historical_validation": "similar past ideas did not behave consistently",
        "insufficient_evidence_for_alpha_bucket": "the supporting information is not strong enough for this higher-risk idea",
        "high_risk_score": "the downside risk is too high for the current score",
        "asset_intelligence_liquidity": "it may not be easy enough to buy or sell before acting",
        "evidence_quality": "source-backed information is limited",
        "minimum_data": "minimum data is not available yet",
        "liquidity_check": "it may be difficult to buy or sell",
        "crypto_cluster_cap": "crypto is capped by the saved risk profile",
        "allocation_cap": "the suggested limit is too low for active buying",
    }
    readable = [labels.get(item, item.replace("_", " ")) for item in failures[:2]]
    return " and ".join(readable) if readable else "the supporting information or fit with your situation is not strong enough to suggest buying"


def _fallback_why_recommended(recommendation: dict[str, Any]) -> str:
    goal = recommendation.get("goalTag") or "your saved goals"
    return (
        f"{recommendation.get('instrumentName', 'This asset')} is linked to {goal}, uses a {recommendation.get('riskLevel', 'Medium')} risk label, "
        f"and has a {recommendation.get('evidenceScore', recommendation.get('confidenceScore', 0))}% supporting-signal score."
    )


def _fallback_why_now(recommendation: dict[str, Any]) -> str:
    return (
        "Timing is based on current market conditions, "
        f"{recommendation.get('keyTrigger') or recommendation.get('marketRegimeSummary') or 'available market information'}, and the suggested review plan."
    )


def _is_watchlist(recommendation: dict[str, Any]) -> bool:
    return str(recommendation.get("action", "")).lower() == "watchlist" or str(recommendation.get("recommendationState", "")).lower() == "watchlist"


def _sentence(value: Any, fallback: str) -> str:
    text = " ".join(str(value or fallback or "").split())
    if not text:
        text = fallback
    if text[-1] not in ".!?":
        text += "."
    return text


def _ui_sentence(value: Any, fallback: str, limit: int = 180) -> str:
    text = _sentence(value, fallback)
    if len(text) <= limit:
        return text
    return _sentence(_brief(text, limit), fallback)


def _brief(value: Any, limit: int = 160) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    sentence_end = max(text.rfind(". ", 0, limit), text.rfind("; ", 0, limit))
    if sentence_end >= 60:
        return text[: sentence_end + 1].strip()
    comma = text.rfind(", ", 0, limit)
    if comma >= 80:
        return text[:comma].strip()
    words = text[:limit].split()
    return " ".join(words[:-1]).rstrip(" ,;:")


def _entry_phrase(value: Any) -> str:
    text = " ".join(str(value or "staggered entry").split()).strip().rstrip(" .;:")
    lower = text.lower()
    for prefix in ("use ", "consider ", "start "):
        if lower.startswith(prefix):
            text = text[len(prefix):].strip().rstrip(" .;:")
            break
    if ";" in text:
        text = text.split(";", 1)[0].strip()
    return text or "staggered entry"


def _reason_phrase(value: Any) -> str:
    text = _brief(value, 115).strip().rstrip(" .;:")
    if not text:
        return "current evidence affects timing"
    text = text[:1].lower() + text[1:]
    if text.startswith("protect "):
        return "protecting " + text[len("protect "):]
    if text.startswith("increase "):
        return "increasing " + text[len("increase "):]
    if text.startswith("reduce "):
        return "reducing " + text[len("reduce "):]
    return text


def _clause(value: Any, limit: int) -> str:
    raw = " ".join(str(value or "").split())
    first_end = raw.find(". ")
    if 0 < first_end <= limit + 35:
        raw = raw[:first_end]
    text = _brief(raw, limit).strip().rstrip(" .!?;:")
    return text or "evidence weakens"


def _trust_labels(
    recommendation: dict[str, Any],
    contradiction_analysis: dict[str, Any],
    uncertainty_analysis: dict[str, Any],
    confidence_breakdown: dict[str, Any],
) -> list[str]:
    labels = [recommendation.get("strategyBucket") or recommendation.get("recommendationType") or "Core"]
    if recommendation.get("convictionScore", 0) >= 75:
        labels.append("High Conviction")
    if recommendation.get("riskLevel") == "High":
        labels.append("High Risk")
    if recommendation.get("recommendationState") == "watchlist" or recommendation.get("action") == "watchlist":
        labels.append("Watchlist")
    if recommendation.get("technicalScore", 0) >= 65:
        labels.append("Momentum Driven")
    if recommendation.get("fundamentalScore", 0) >= 65:
        labels.append("Fundamental Play")
    if recommendation.get("keyTrigger") and recommendation.get("marketRegime"):
        labels.append("Macro-Driven")
    if contradiction_analysis.get("contradictionCount", 0):
        labels.append("Contradictions Present")
    if uncertainty_analysis.get("uncertaintyLevel") != "low":
        labels.append("Uncertainty Flag")
    if confidence_breakdown.get("overall", 0) < 60:
        labels.append("Lower Confidence")
    return _unique(labels)[:8]


def _recommendation_key(recommendation: dict[str, Any]) -> str:
    if recommendation.get("recommendationKey"):
        return recommendation["recommendationKey"]
    raw = "|".join(
        [
            str(recommendation.get("instrumentName") or recommendation.get("assetName") or ""),
            str(recommendation.get("ticker") or ""),
            str(recommendation.get("assetType") or recommendation.get("assetClass") or ""),
            str(recommendation.get("goalTag") or recommendation.get("linkedGoals", [{}])[0].get("name", "")),
        ]
    ).lower()
    return sha1(raw.encode("utf-8")).hexdigest()[:16]


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result = []
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def _clamp(value: Any) -> int:
    try:
        return max(0, min(100, round(float(value))))
    except (TypeError, ValueError):
        return 50
