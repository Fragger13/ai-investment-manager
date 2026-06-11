from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.services.intelligence import now_iso
from app.services.evidence.evidence_relevance_service import is_raw_data_text, normalize_asset_class
from app.services.llm.model_router import refine_asset_copy

LIMITED_VALIDATED_DATA = "Limited validated data available."


def build_asset_intelligence_copy(asset: dict[str, Any], evidence: list[dict[str, Any]], llm_enhance: bool = True) -> dict[str, Any]:
    asset_name = asset.get("assetName") or asset.get("instrumentName") or asset.get("name") or "This asset"
    asset_type = asset.get("assetType") or asset.get("assetClass") or ""
    category = asset.get("category") or ""
    asset_class = asset.get("normalizedAssetClass") or normalize_asset_class(asset_type, category)
    sector = asset.get("sectorTheme") or "Diversified"
    technical = asset.get("technical") or {}
    fundamental = asset.get("fundamental") or {}
    liquidity = asset.get("liquidity") or {}
    risk = asset.get("risk") or {}
    crypto = asset.get("crypto") or {}

    fallback_copy = {
        "summary": _summary(asset_name, asset_class, sector),
        "whyThisMatters": _why_this_matters(asset_name, asset_class, sector),
        "why_this_matters": _why_this_matters(asset_name, asset_class, sector),
        "whyNow": _why_now(asset_name, asset_class, sector, technical, fundamental, crypto, evidence),
        "why_now": _why_now(asset_name, asset_class, sector, technical, fundamental, crypto, evidence),
        "suitableFor": _suitable_for(asset_class, asset_name, risk, liquidity),
        "suitable_for": _suitable_for(asset_class, asset_name, risk, liquidity),
        "supportingEvidence": _supporting_evidence(evidence),
        "supporting_evidence": _supporting_evidence(evidence),
        "risks": _risks(asset_class, risk, liquidity, crypto),
        "dataPoints": _data_points(asset, technical, fundamental, liquidity, crypto),
        "data_points": _data_points(asset, technical, fundamental, liquidity, crypto),
        "invalidationTrigger": _invalidation_trigger(asset_class, technical, fundamental, liquidity, risk),
        "invalidation_trigger": _invalidation_trigger(asset_class, technical, fundamental, liquidity, risk),
    }
    if not llm_enhance:
        return {**fallback_copy, **_llm_metadata(False, "not_requested")}
    return refine_asset_copy(asset, evidence, fallback_copy)


def _summary(asset_name: str, asset_class: str, sector: str) -> str:
    lower_name = asset_name.lower()
    if "liquid" in lower_name:
        return complete_sentence_summary(f"{asset_name} is designed to keep money steadier and easier to access than shares. It may be useful for emergency savings or a nearer goal, although it still carries some risk.", 260)
    if "gold" in lower_name or sector == "Gold / Precious Metals":
        return complete_sentence_summary(f"{asset_name} may add stability when markets feel uncertain. It can help reduce dependence on shares when inflation, currency moves, or global events create concern.", 260)
    if asset_class == "Mutual Funds" and ("nifty" in lower_name or "index" in lower_name):
        return complete_sentence_summary(f"{asset_name} gives broad exposure to India’s largest listed companies. It can be useful for long-term wealth creation when you want equity participation without selecting individual stocks.", 260)
    if asset_class == "Mutual Funds":
        return complete_sentence_summary(f"{asset_name} spreads money across a group of investments. It may suit people who want a simpler approach than choosing individual shares.", 240)
    if asset_class == "Debt Funds":
        return complete_sentence_summary(f"{asset_name} is designed for steadier returns than shares. It may be useful for emergency savings or short-term goals, although it still carries some risk.", 260)
    if asset_class == "ETFs":
        return complete_sentence_summary(f"{asset_name} gives access to a group of investments through the stock exchange. It may be a simple option if it is easy to buy and sell.", 260)
    if asset_class == "Commodities":
        return complete_sentence_summary(f"{asset_name} may add stability when markets feel uncertain. It can help reduce dependence on shares when inflation, currency moves, or global events create concern.", 260)
    if asset_class == "Crypto":
        return complete_sentence_summary(f"{asset_name} is a high-risk digital asset that can move sharply in price. Keep it small and consider it only after emergency savings and long-term investments are in place.", 250)
    if asset_class == "Stocks / Equities":
        return complete_sentence_summary(f"{asset_name} is a company linked to the {sector} area. Keep the amount limited because one company can be less predictable than a fund that spreads money across many investments.", 250)
    return complete_sentence_summary(f"{asset_name} is an idea to keep reviewing. More supporting information is needed before it becomes a stronger suggestion.", 220)


def _why_this_matters(asset_name: str, asset_class: str, sector: str) -> str:
    if "liquid" in asset_name.lower():
        return "A liquid fund can help protect money you may need soon while keeping it easier to access than many longer-term investments."
    if "gold" in asset_name.lower() or sector == "Gold / Precious Metals":
        return "Gold can help protect part of your money when inflation, currency moves, or global events make markets uncertain."
    if asset_class == "Mutual Funds":
        return "A diversified fund can help build wealth over time without depending on the performance of one company."
    if asset_class == "Debt Funds":
        return "A debt fund may help keep part of your money steadier and easier to access, but it still needs a basic risk check."
    if asset_class == "ETFs":
        return "An ETF can be a simple way to invest in a group of assets, but check that it is easy to buy and sell."
    if asset_class == "Commodities":
        return "Gold and commodities may add stability when inflation, currency moves, or global events make markets uncertain."
    if asset_class == "Crypto":
        return "Digital assets can move sharply in price. Consider them only if you are comfortable with high risk, and never use money needed for important goals."
    if asset_class == "Stocks / Equities":
        return complete_sentence_summary(f"This company is linked to the {sector} area and may benefit if that trend continues. It still needs to remain easy to buy and sell, with healthy business performance.", 240)
    return "This idea matters only if the supporting information improves and it fits your goals, comfort with risk, and current investments."


def _why_now(asset_name: str, asset_class: str, sector: str, technical: dict[str, Any], fundamental: dict[str, Any], crypto: dict[str, Any], evidence: list[dict[str, Any]]) -> str:
    if technical and technical.get("breakoutStatus"):
        return complete_sentence_summary(f"The current price trend is {technical.get('breakoutStatus')}. The tracked trend score is {technical.get('trendStrength', 'limited')}%, so review the suggested range before acting.", 230)
    if crypto and crypto.get("narrative"):
        return complete_sentence_summary(f"The reason to review this digital asset now is {crypto.get('narrative')}. Recheck it often because prices and trading activity can change quickly.", 220)
    if evidence:
        lead = evidence[0]
        relation = lead.get("relationship_type", "source-backed")
        if asset_class in {"Mutual Funds", "Debt Funds", "ETFs"}:
            return complete_sentence_summary(f"Fresh fund information is available for {asset_name}. Review whether it still matches your timeline and how quickly you may need the money.", 230)
        if relation == "sector_related":
            return complete_sentence_summary(f"A recent update is connected to the {sector} area. Review whether that trend is becoming strong enough to support {asset_name}.", 230)
        if relation == "direct_asset":
            return complete_sentence_summary(f"Fresh information directly linked to {asset_name} is available. Review it alongside the latest risk and price-trend checks before acting.", 230)
        return complete_sentence_summary(f"Fresh supporting information is available for {asset_name}. Review it alongside the latest risk and price-trend checks before acting.", 230)
    if fundamental and fundamental.get("sectorTailwindScore", 0) >= 65:
        return complete_sentence_summary(f"The {sector} area is showing a supportive trend, but direct information for this investment is still limited.", 200)
    return LIMITED_VALIDATED_DATA


def _suitable_for(asset_class: str, asset_name: str, risk: dict[str, Any], liquidity: dict[str, Any]) -> str:
    risk_label = str(risk.get("riskCategory") or "medium").lower()
    if "liquid" in asset_name.lower():
        return f"{asset_name} may suit someone building emergency savings or protecting money for a nearer goal."
    if asset_class in {"Debt Funds", "Bonds", "Cash / Liquid"}:
        return f"{asset_name} may suit someone protecting money for a nearer goal or building a steadier part of their plan."
    if "gold" in asset_name.lower() or asset_class == "Commodities":
        return f"{asset_name} may suit someone who wants a small amount of protection when markets feel uncertain."
    if asset_class == "Crypto":
        return f"{asset_name} may suit only someone comfortable with large price swings after emergency savings and important goals are protected."
    if asset_class == "Stocks / Equities":
        return f"{asset_name} may suit someone with a longer timeline who can accept {risk_label} risk and keep a single-company position small."
    if liquidity.get("minimumLiquidityPassed") is False:
        return f"{asset_name} is better kept on a watchlist until it becomes easier to buy and sell."
    return f"{asset_name} may suit someone whose timeline, comfort with risk, and current investments match this idea."


def _supporting_evidence(evidence: list[dict[str, Any]]) -> list[str]:
    points = []
    for item in evidence[:3]:
        summary = item.get("summary") or item.get("sourceName") or ""
        source_name = item.get("sourceName", "Source")
        if is_raw_data_text(summary) or summary.strip().lower() in {source_name.lower(), f"{source_name.lower()}."}:
            summary = f"{source_name} provides relevant source data for this asset."
        relation = item.get("relationship_type", "related").replace("_", " ")
        points.append(complete_sentence_summary(f"{summary} This is {relation} information.", 210))
    return points or [LIMITED_VALIDATED_DATA]


def _risks(asset_class: str, risk: dict[str, Any], liquidity: dict[str, Any], crypto: dict[str, Any]) -> list[str]:
    risks = []
    if risk.get("riskNotes"):
        risks.append(complete_sentence_summary(risk["riskNotes"], 180))
    if liquidity.get("liquidityNotes"):
        risks.append(complete_sentence_summary(liquidity["liquidityNotes"], 180))
    if crypto.get("riskWarning"):
        risks.append(complete_sentence_summary(crypto["riskWarning"], 180))
    if asset_class == "Stocks / Equities":
        risks.append("A single company can disappoint if its profits weaken, its share price becomes too expensive, or its industry slows down.")
    elif asset_class == "Crypto":
        risks.append("Digital assets can lose substantial value quickly, so keep the amount small.")
    elif asset_class == "Commodities":
        risks.append("Gold and commodities can lag for long periods when investors feel more confident about other assets.")
    return risks[:3] or ["Market conditions can change quickly, so this idea needs periodic review."]


def _data_points(asset: dict[str, Any], technical: dict[str, Any], fundamental: dict[str, Any], liquidity: dict[str, Any], crypto: dict[str, Any]) -> list[str]:
    points = []
    for item in asset.get("evidence", [])[:3]:
        if item.get("nav"):
            points.append(f"NAV: {item.get('nav')} as of {item.get('navDate', 'latest available date')}.")
        elif item.get("marketCapInr"):
            points.append(f"Market cap data available from {item.get('sourceName', 'source')}.")
    if technical:
        if technical.get("latestPrice") is not None:
            points.append(f"Latest tracked price: {technical.get('latestPrice')}.")
        if technical.get("rsi") is not None:
            points.append(f"RSI: {technical.get('rsi')}.")
        if technical.get("supportZone"):
            points.append(f"Support zone: {technical.get('supportZone')}.")
    if fundamental:
        points.append(f"Investment-quality score: {fundamental.get('fundamentalScore', 'limited')} with {fundamental.get('dataCompleteness', 'low')} information coverage.")
    if liquidity:
        points.append(f"Ease-of-buying score: {liquidity.get('liquidityScore', 'limited')}.")
    if crypto:
        points.append(f"Strength of the supporting story: {crypto.get('narrativeStrength', 'limited')} with a suggested maximum share of {crypto.get('allocationCap', 0)}%.")
    return [complete_sentence_summary(point, 170) for point in points[:6]] or [LIMITED_VALIDATED_DATA]


def _invalidation_trigger(asset_class: str, technical: dict[str, Any], fundamental: dict[str, Any], liquidity: dict[str, Any], risk: dict[str, Any]) -> str:
    if technical.get("stopLossReference"):
        return complete_sentence_summary(technical["stopLossReference"], 190)
    if fundamental.get("dataCompleteness") == "low":
        return "Keep this on the watchlist if clear business information and direct supporting evidence remain limited."
    if liquidity.get("minimumLiquidityPassed") is False:
        return "Review this idea if it becomes harder to buy or sell in normal market conditions."
    if asset_class == "Crypto":
        return "Review this idea if price swings become too large, buying and selling becomes harder, or the supporting story weakens."
    return "Review this idea if supporting information weakens, buying and selling becomes harder, or market conditions turn against it."


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


def complete_sentence_summary(value: str | None, limit: int = 180, fallback: str = LIMITED_VALIDATED_DATA) -> str:
    text = " ".join(str(value or "").replace("...", ".").split()).strip().rstrip(" ,;:")
    if not text:
        return fallback
    if len(text) <= limit:
        return _complete_sentence(text)
    window = text[:limit]
    sentence_end = max(window.rfind(". "), window.rfind("? "), window.rfind("! "))
    if sentence_end >= 55:
        return _complete_sentence(window[: sentence_end + 1])
    comma = window.rfind(", ")
    if comma >= 70:
        return _complete_sentence(window[:comma])
    words = window.split()
    return _complete_sentence(" ".join(words[:-1]))


def _complete_sentence(value: str) -> str:
    text = " ".join(str(value or "").split()).strip().rstrip(" ,;:")
    if not text:
        return LIMITED_VALIDATED_DATA
    if text.endswith("..."):
        text = text.rstrip(".")
    return text if text[-1] in ".!?" else f"{text}."
