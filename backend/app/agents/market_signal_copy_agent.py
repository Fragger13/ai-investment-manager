from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.services.intelligence import now_iso
from app.services.llm.model_router import refine_market_signal_copy


def build_market_signal_copy(signal: dict[str, Any], llm_enhance: bool = True) -> dict[str, Any]:
    benefits = signal.get("likelyBeneficiaries") or []
    losers = signal.get("likelyLosers") or []
    clean_title = _complete(signal.get("clean_headline") or signal.get("title") or _fallback_headline(signal, benefits, losers))
    fallback = {
        "title": clean_title,
        "clean_headline": clean_title,
        "summary": _fallback_summary(signal, benefits, losers),
        "whyItMatters": _fallback_why_it_matters(signal),
        "why_it_matters": _fallback_why_it_matters(signal),
        "who_benefits": benefits[:3],
        "who_is_at_risk": losers[:3],
        "whatToWatchNext": _what_to_watch_next(signal),
        "what_to_watch_next": _what_to_watch_next(signal),
        "user_relevance": _user_relevance(signal),
    }
    if not llm_enhance:
        return {**fallback, **_llm_metadata(False, "not_requested")}
    return refine_market_signal_copy(signal, fallback)


def _complete(value: Any) -> str:
    text = " ".join(str(value or "").replace("...", ".").split()).strip().rstrip(" ,;:")
    if not text:
        return "Limited supporting information is available."
    return text if text[-1:] in ".!?" else f"{text}."


def _fallback_headline(signal: dict[str, Any], benefits: list[str], losers: list[str]) -> str:
    if benefits:
        return f"Market update may help {', '.join(benefits[:2])}"
    if losers:
        return f"Market update may create challenges for {', '.join(losers[:2])}"
    return "Market update needs review"


def _fallback_summary(signal: dict[str, Any], benefits: list[str], losers: list[str]) -> str:
    raw = str(signal.get("summary") or "")
    instruments = signal.get("relevantInstruments") or signal.get("instruments") or []
    signal_type = str(signal.get("signalType") or "market").replace("_", " ")
    if "nav record" in raw.lower() or "latest nav" in raw.lower():
        instrument = instruments[0] if instruments else "the fund"
        return _complete(f"Updated information is available for {instrument}. Use it as a reference point, not as a reason to expect returns")
    if benefits and losers:
        return _complete(f"This market update may help {', '.join(benefits[:2])} while creating challenges for {', '.join(losers[:2])}")
    if benefits:
        return _complete(f"This market update may help {', '.join(benefits[:3])} if the trend continues")
    if losers:
        return _complete(f"This market update may create challenges for {', '.join(losers[:3])}, so keep an eye on it")
    return _complete("This market update is useful context, but it is not strong enough to drive a decision on its own")


def _what_to_watch_next(signal: dict[str, Any]) -> str:
    if _is_nav_update(signal):
        return "Watch whether the fund still matches your timeline, access needs, and comfort with risk before adding more money."
    risks = signal.get("riskSignals") or []
    opportunities = signal.get("opportunitySignals") or []
    if risks:
        return _complete(f"Watch whether {', '.join(risks[:2])} becomes more important before changing your investments")
    if opportunities:
        return _complete(f"Watch whether {', '.join(opportunities[:2])} continues before acting on this update")
    return "Watch whether the signal becomes stronger, affects company results, or starts changing prices before acting."


def _user_relevance(signal: dict[str, Any]) -> str:
    if _is_nav_update(signal):
        return "This may matter if you use a liquid or index fund for emergency savings, a near-term goal, or regular long-term investing."
    related = signal.get("relatedRecommendations") or []
    if related:
        return _complete(f"This may matter for you because it is linked to suggested actions involving {', '.join(related[:2])}")
    if signal.get("relatedRecommendation"):
        return _complete(f"This may matter for you because it is linked to {signal['relatedRecommendation']}")
    if signal.get("portfolioRelevance", 0) >= 70:
        return "This may matter for you because it could affect investments already represented in your plan."
    return "Use this as helpful context while reviewing your goals and investments, not as a reason to act on its own."


def _fallback_why_it_matters(signal: dict[str, Any]) -> str:
    if _is_nav_update(signal):
        return "This gives you a fresh reference point for reviewing the fund. It does not show that returns are guaranteed or that you need to act now."
    return _complete(signal.get("whyItMatters") or "This update may affect when you invest, but it should not drive a decision on its own.")


def _is_nav_update(signal: dict[str, Any]) -> bool:
    text = f"{signal.get('title', '')} {signal.get('summary', '')}".lower()
    return "nav record" in text or "latest nav" in text or "nav update" in text


def _llm_metadata(enhanced: bool, reason: str | None) -> dict[str, Any]:
    return {
        "llm_enhanced": enhanced,
        "llm_provider": settings.llm_provider if settings.llm_enabled else "none",
        "llm_model": settings.llm_model_fast or settings.llm_model,
        "llm_generated_at": now_iso(),
        "llm_fallback_reason": None if enhanced else reason,
        "llmEnhanced": enhanced,
        "llmProvider": settings.llm_provider if settings.llm_enabled else "none",
        "llmModel": settings.llm_model_fast or settings.llm_model,
        "llmGeneratedAt": now_iso(),
        "llmFallbackReason": None if enhanced else reason,
    }
