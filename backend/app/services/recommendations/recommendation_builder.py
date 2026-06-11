from __future__ import annotations

from datetime import UTC, datetime
from hashlib import sha1

from app.agents.action_plan_agent import build_action_plan, review_date
from app.agents.portfolio_suitability_agent import analyze_asset_fit_with_context
from app.schemas.financial import OnboardingProfile
from app.services.intelligence import DISCLAIMER
from app.services.recommendations.asset_screening_service import ResearchAsset, signals_for_asset
from app.services.recommendations.suitability_scoring_service import ProfileContext


def build_recommendation(profile: OnboardingProfile, context: ProfileContext, asset: ResearchAsset, signals: list[dict], priority: int, fit_override: dict | None = None) -> dict | None:
    supporting, conflicting = signals_for_asset(asset, signals)
    fit = fit_override or analyze_asset_fit_with_context(context, asset, supporting, conflicting)
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
    verb = "Build emergency savings with" if asset.asset_key == "debt" else "Start regular investing in" if asset.asset_key == "equity" else "Use a small part of your plan for" if asset.asset_key == "gold" else "Consider a small short-term amount in" if asset.asset_key == "tactical" else "Only consider a small amount in"
    return f"{verb} {asset.instrument_name}"


def _user_reasoning(profile: OnboardingProfile, context: ProfileContext, asset: ResearchAsset, fit: dict) -> str:
    """Profile-aware reasoning that references actual numbers and goals."""
    age = context.age
    name_goal = _top_goal_name(profile)
    surplus_str = f"₹{context.surplus:,}/month"

    if "asset intelligence" in asset.category.lower():
        action = "keep-an-eye-on" if "watchlist" in asset.category.lower() else "small short-term"
        return (
            f"{asset.instrument_name} surfaced from the research review as a {action} idea with a "
            f"{asset.confidence_score}% confidence level. It fits only as a small slice outside your core plan, "
            f"because your surplus is {surplus_str} and your core goals come first."
        )

    if asset.asset_key == "debt":
        parts = []
        if context.emergency_gap > 0:
            parts.append(
                f"You still need about ₹{context.emergency_gap:,} more in emergency savings, "
                f"which is why a steadier option comes before more market risk."
            )
        elif context.age_band in {"pre_retire", "senior"}:
            parts.append(
                f"At {age}, capital preservation matters more than chasing returns — debt is your stability layer."
            )
        elif context.has_short_term_goals:
            parts.append(
                f"You have near-term goals (within 3 years) — debt funds protect that money from equity swings."
            )
        else:
            parts.append("Your emergency cover is close to the suggested level, so debt becomes a smaller stability layer rather than the main investment.")
        if context.irregular_income:
            parts.append("Your income is irregular, so a debt buffer also smooths month-to-month volatility.")
        return " ".join(parts)

    if asset.asset_key == "equity":
        horizon = profile.investmentHorizon or "long-term"
        parts = []
        if context.age_band == "young":
            parts.append(f"At {age}, you have the longest possible runway for compounding — equity rewards patience.")
        elif context.age_band == "mid":
            parts.append(f"At {age}, equity is still your main growth engine — you have time to ride out market cycles.")
        elif context.age_band == "pre_retire":
            parts.append(f"At {age}, equity stays in the mix but with a smaller share — risk capacity is lower than it was at 30.")
        else:
            parts.append(f"At {age}, equity should be a small minority of your investments — capital preservation comes first.")
        if name_goal:
            parts.append(f"This investment is sized to support your goal: {name_goal}.")
        else:
            parts.append("Add a long-term goal so we can size this against a real target.")
        if context.portfolio_equity_share > 0.65:
            parts.append("Your portfolio is already heavy on equity, so the suggested amount is on the lower side.")
        elif context.portfolio_equity_share < 0.15 and context.age_band in {"young", "mid"}:
            parts.append("You are currently under-allocated to equity for your age, so this is a meaningful tilt.")
        if context.panic_risk:
            parts.append("Because your behaviour profile shows panic-sell risk, the SIP is sized small enough to ride out swings without forcing you to react.")
        return " ".join(parts)

    if asset.asset_key == "gold":
        parts = ["Gold helps spread your money beyond shares and debt funds, especially when markets are volatile."]
        if context.portfolio_gold_share > 0.12:
            parts.append(f"Your existing gold share is already ~{round(context.portfolio_gold_share * 100)}% — that's enough; this should be capped at 10-12% of investments total.")
        if context.age_band in {"pre_retire", "senior"}:
            parts.append("A small gold tilt is reasonable as you approach retirement for added stability.")
        return " ".join(parts)

    if asset.asset_key == "tactical":
        parts = ["This is a short-term tactical idea — keep it small, review it monthly, and never use money tied to important goals."]
        if context.disciplined and context.income_tier in {"high", "ultra"}:
            parts.append("Your discipline and income tier make a small tactical slice acceptable.")
        elif not context.disciplined:
            parts.append("Because your investing discipline is still developing, the suggested amount is on the lower side.")
        return " ".join(parts)

    if asset.asset_key == "crypto":
        parts = [
            "Crypto fits only if you already have emergency money, core SIPs running, and are comfortable with sharp drops.",
        ]
        if context.portfolio_crypto_share > 0.05:
            parts.append(f"Your existing crypto share is ~{round(context.portfolio_crypto_share * 100)}% — already at the cap; no further allocation suggested.")
        if context.age_band in {"pre_retire", "senior"}:
            parts.append("At your age, crypto should be a very small or zero allocation.")
        if context.emergency_gap > 0:
            parts.append(f"Fix the ₹{context.emergency_gap:,} emergency gap first before adding crypto exposure.")
        return " ".join(parts)

    return "This only fits if you are comfortable with large temporary losses and already have emergency money and core investments in place."


def _market_reasoning(asset: ResearchAsset, supporting: list[dict], conflicting: list[dict]) -> str:
    if "asset intelligence" in asset.category.lower():
        signal_text = supporting[0]["summary"] if supporting else "matching market signals are limited"
        conflict_text = f" Main conflict: {conflicting[0]['summary']}" if conflicting else ""
        return f"Investment idea summary: {asset.summary} Related market update: {signal_text}.{conflict_text}"
    if supporting:
        best = supporting[0]
        return f"Supporting information: {best['summary']} Source quality: {best['credibilityScore']}%. Investment details: {asset.summary}"
    if conflicting:
        return f"Market information is mixed. Main caution: {conflicting[0]['summary']} Investment details: {asset.summary}"
    return f"Investment details are available, but there are not enough matching market updates yet. Investment details: {asset.summary}"


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
    if "asset intelligence" in asset.category.lower():
        return "This idea can weaken if its price trend reverses, investment quality falls, buying and selling becomes harder, or markets become more cautious."
    if asset.asset_key == "equity":
        return "A market correction can reduce value soon after you start. If you stop SIPs or sell during a fall, long-term compounding can be hurt."
    if asset.asset_key == "debt":
        return "Returns may be modest, and rare credit or liquidity events can affect debt funds. Check the latest portfolio before investing."
    if asset.asset_key == "gold":
        return "Gold may stay flat while equity or debt performs better. SGBs also have liquidity and tenure constraints."
    if asset.asset_key == "tactical":
        return "A sector trend can reverse quickly. A short-term idea can perform poorly even when your long-term investments are doing fine."
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


def _top_goal_name(profile: OnboardingProfile) -> str:
    goals = sorted(profile.goals or [], key=lambda g: (g.priority or 9, -(g.targetAmount or 0)))
    if not goals:
        return ""
    top = goals[0]
    return top.customName or top.type or ""


def _combined_mode(asset: ResearchAsset, supporting: list[dict]) -> str:
    if asset.data_mode in {"limited", "fallback"}:
        return asset.data_mode
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
