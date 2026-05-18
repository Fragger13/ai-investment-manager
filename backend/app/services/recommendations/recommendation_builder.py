from __future__ import annotations

from datetime import UTC, datetime
from hashlib import sha1

from app.agents.action_plan_agent import build_action_plan, review_date
from app.agents.portfolio_suitability_agent import analyze_asset_fit_with_context
from app.schemas.financial import OnboardingProfile
from app.services.intelligence import DISCLAIMER
from app.services.recommendations.asset_screening_service import ResearchAsset, signals_for_asset
from app.services.recommendations.suitability_scoring_service import ProfileContext


def build_recommendation(profile: OnboardingProfile, context: ProfileContext, asset: ResearchAsset, signals: list[dict], priority: int) -> dict | None:
    supporting, conflicting = signals_for_asset(asset, signals)
    fit = analyze_asset_fit_with_context(context, asset, supporting, conflicting)
    if fit["suggestedAllocationPercentage"] <= 0 or fit["suggestedMonthlyAmount"] <= 0:
        return None
    if fit["suitabilityScore"] < 45:
        return None
    action = build_action_plan(asset, context, fit)
    timestamp = datetime.now(UTC).isoformat(timespec="seconds")
    source_links = _source_links(asset, supporting, conflicting)
    return {
        "id": _stable_id(asset.instrument_name),
        "recommendationTitle": _title(asset),
        "instrumentName": asset.instrument_name,
        "assetType": asset.asset_type,
        "suggestedMonthlyAmount": fit["suggestedMonthlyAmount"],
        "suggestedAllocationPercentage": fit["suggestedAllocationPercentage"],
        "priorityOrder": priority,
        "userSpecificReasoning": _user_reasoning(profile, context, asset, fit),
        "currentMarketReasoning": _market_reasoning(asset, supporting, conflicting),
        "supportingSignals": _compact_signals(supporting),
        "contradictorySignals": _compact_signals(conflicting),
        "riskExplanation": _risk_explanation(asset, context),
        "whatCanGoWrong": _what_can_go_wrong(asset),
        "actionPlan": action["actionPlan"],
        "entryApproach": action["entryApproach"],
        "reviewDate": review_date(asset.asset_key),
        "exitOrRebalanceCondition": action["exitOrRebalanceCondition"],
        "sourceLinks": source_links,
        "dataTimestamp": timestamp,
        "dataMode": _combined_mode(asset, supporting),
        "confidenceScore": fit["confidenceScore"],
        "suitabilityScore": fit["suitabilityScore"],
        "riskLevel": fit["riskLevel"],
        "timeHorizon": action["timeHorizon"],
        "goalTag": action["goalTag"],
        "disclaimer": DISCLAIMER,
    }


def _stable_id(name: str) -> str:
    digest = sha1(name.encode("utf-8")).hexdigest()[:10]
    return f"research-rec-{digest}"


def _title(asset: ResearchAsset) -> str:
    verb = "Build emergency money with" if asset.asset_key == "debt" else "Start a SIP in" if asset.asset_key == "equity" else "Use a small allocation to" if asset.asset_key == "gold" else "Only consider a capped satellite allocation to"
    return f"{verb} {asset.instrument_name}"


def _user_reasoning(profile: OnboardingProfile, context: ProfileContext, asset: ResearchAsset, fit: dict) -> str:
    if asset.asset_key == "debt":
        if context.emergency_gap > 0:
            return f"You still have an emergency fund gap of about ₹{context.emergency_gap:,}. This is why a lower-volatility option gets priority before taking more market risk."
        return "Your emergency fund looks closer to target, so this can stay as a smaller stability allocation rather than the main investment."
    if asset.asset_key == "equity":
        horizon = profile.investmentHorizon or "long-term"
        return f"This fits a {horizon} goal better than short-term needs. A SIP helps you invest steadily without trying to guess the perfect market entry date."
    if asset.asset_key == "gold":
        return "This is mainly for diversification. It can help reduce dependence on only equity or debt, but it should stay a small part of the portfolio."
    return "This only fits if you are comfortable with large temporary losses and already have emergency money and core investments in place."


def _market_reasoning(asset: ResearchAsset, supporting: list[dict], conflicting: list[dict]) -> str:
    if supporting:
        best = supporting[0]
        return f"Research support: {best['summary']} Source credibility: {best['credibilityScore']}%. Asset data: {asset.summary}"
    if conflicting:
        return f"Market evidence is mixed. Main caution: {conflicting[0]['summary']} Asset data: {asset.summary}"
    return f"Asset research is available, but there are not enough matching market signals yet. Asset data: {asset.summary}"


def _risk_explanation(asset: ResearchAsset, context: ProfileContext) -> str:
    if asset.asset_key == "equity":
        extra = " Because your behavior profile shows panic-selling risk, use a smaller SIP and avoid checking daily NAV." if context.panic_risk else ""
        return f"Equity can fall for months or years, so it is unsuitable for money needed soon.{extra}"
    if asset.asset_key == "debt":
        return "This is lower risk than equity, but it is not a bank deposit. Credit quality, interest-rate changes, tax rules, and exit rules still matter."
    if asset.asset_key == "gold":
        return "Gold can protect during some uncertain periods, but it can also underperform for long stretches and should not replace a core plan."
    return "Crypto can move sharply in either direction, has regulatory uncertainty, and should never be used for essential goals."


def _what_can_go_wrong(asset: ResearchAsset) -> str:
    if asset.asset_key == "equity":
        return "A market correction can reduce value soon after you start. If you stop SIPs or sell during a fall, long-term compounding can be hurt."
    if asset.asset_key == "debt":
        return "Returns may be modest, and rare credit or liquidity events can affect debt funds. Check the latest portfolio before investing."
    if asset.asset_key == "gold":
        return "Gold may stay flat while equity or debt performs better. SGBs also have liquidity and tenure constraints."
    return "The price can fall sharply, regulation can change, and the asset can become unsuitable if your risk comfort changes."


def _source_links(asset: ResearchAsset, supporting: list[dict], conflicting: list[dict]) -> list[dict]:
    links = []
    for item in asset.evidence:
        links.append(
            {
                "name": item.get("sourceName", "Research source"),
                "url": item.get("sourceUrl", ""),
                "retrievedAt": asset.retrieved_at,
                "dataMode": item.get("dataMode", asset.data_mode),
                "supportType": "asset-data",
                "credibilityScore": 95 if item.get("sourceName") == "AMFI India" else 82 if item.get("sourceName") == "CoinGecko" else 75,
            }
        )
    for signal in supporting[:3]:
        links.append(_signal_source(signal, "supporting"))
    for signal in conflicting[:2]:
        links.append(_signal_source(signal, "conflicting"))
    unique = []
    seen = set()
    for link in links:
        key = (link["name"], link["url"], link["supportType"])
        if key in seen or not link["url"]:
            continue
        seen.add(key)
        unique.append(link)
    return unique


def _signal_source(signal: dict, support_type: str) -> dict:
    return {
        "name": signal.get("sourceName", "Research source"),
        "url": signal.get("sourceUrl", ""),
        "retrievedAt": signal.get("retrievedAt", ""),
        "dataMode": signal.get("dataMode", "fallback"),
        "supportType": support_type,
        "credibilityScore": signal.get("credibilityScore", 50),
    }


def _compact_signals(signals: list[dict]) -> list[dict]:
    compacted = []
    for signal in signals:
        item = dict(signal)
        item["summary"] = _shorten(item.get("summary", ""), 420)
        item["title"] = _shorten(item.get("title", item["summary"]), 90)
        compacted.append(item)
    return compacted


def _shorten(value: str, limit: int) -> str:
    value = " ".join((value or "").split())
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "..."


def _combined_mode(asset: ResearchAsset, supporting: list[dict]) -> str:
    modes = [asset.data_mode, *[signal.get("dataMode", "fallback") for signal in supporting]]
    if "live" in modes:
        return "live"
    if "cached" in modes:
        return "cached"
    if "delayed" in modes:
        return "delayed"
    if "limited" in modes:
        return "limited"
    return "fallback"
