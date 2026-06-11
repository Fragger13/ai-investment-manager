from __future__ import annotations

from typing import Any

from app.services.llm.model_router import generate_chat_answer


def answer_with_context(message: str, context: dict[str, Any]) -> str:
    fallback = _deterministic_answer_with_context(message, context)
    return generate_chat_answer(message, context, fallback)


def _deterministic_answer_with_context(message: str, context: dict[str, Any]) -> str:
    lower = message.lower()
    profile = context.get("profile", {})
    top = context.get("topRecommendation", {})
    portfolio = context.get("portfolio", {})
    market = context.get("market", {})
    goals = context.get("dashboard", {}).get("goals", [])
    recommendations = context.get("recommendations", [])
    copilot = context.get("copilot", {})

    if any(term in lower for term in ["what should i do today", "highest priority", "review today", "do today"]):
        return _daily_action_answer(copilot)
    if any(term in lower for term in ["next month", "invest in next month", "do this month"]):
        return _monthly_action_answer(copilot)
    if any(term in lower for term in ["changed this week", "weekly score", "financial health this week"]):
        return _weekly_answer(copilot)
    if any(term in lower for term in ["strongest", "prioritize", "best recommendation", "what should i focus"]):
        return _focus_answer(profile, top, portfolio, context.get("keyRisks", []))
    if "gold" in lower:
        rec = _find_rec(recommendations, "gold") or top
        signal = _find_signal(market.get("signals", []), ["gold", "geopolitical", "defensive"])
        return _recommendation_answer(rec, signal, "Gold is usually used to add stability when markets feel uncertain. It does not guarantee returns.")
    if any(term in lower for term in ["crypto", "bitcoin", "ethereum"]):
        rec = _find_rec(recommendations, "crypto") or _find_rec(recommendations, "bitcoin") or _find_rec(recommendations, "ethereum")
        cap = portfolio.get("summary", {}).get("cryptoAllocationCap", 0)
        if not rec:
            return f"Digital assets are not a priority for you right now. Your limit is {cap}%, so the app keeps them small unless your comfort with risk, emergency savings, and goal timelines allow more."
        return _recommendation_answer(rec, None, f"Digital assets are limited to {cap}% because they can fall sharply and should never use money needed for important goals.")
    if any(term in lower for term in ["underfunded", "falling behind", "goal"]):
        return _goal_answer(goals, profile)
    if any(term in lower for term in ["too risky", "portfolio risk", "balanced", "overexposed", "rebalance"]):
        return _portfolio_answer(portfolio, context.get("keyRisks", []))
    if any(term in lower for term in ["market risk", "watch", "market signal", "regime"]):
        return _market_answer(market, context.get("importantSignals", []))
    if any(term in lower for term in ["why", "suggested", "recommended", "recommendation", "stock", "fund"]):
        rec = _matching_recommendation(lower, recommendations) or top
        return _recommendation_answer(rec, None, "This is decision support, not a guarantee.")
    return _focus_answer(profile, top, portfolio, context.get("keyRisks", []))


def _daily_action_answer(copilot: dict[str, Any]) -> str:
    action = copilot.get("recommendedAction") or {}
    if not action:
        return "I do not have a daily action plan yet. Update your financial profile, then refresh the dashboard."
    amount = f" Set aside about Rs {action.get('amount', 0):,.0f} this month." if action.get("amount") else ""
    return f"Your highest priority is to {str(action.get('title', 'review your plan')).lower()}. {action.get('detail', '')}{amount}"


def _monthly_action_answer(copilot: dict[str, Any]) -> str:
    coach = copilot.get("cashflowCoach") or {}
    if not coach:
        return "I do not have a monthly action yet. Update your income, expenses, and goals so I can suggest one practical next step."
    amount = f" The suggested amount is about Rs {coach.get('amount', 0):,.0f}." if coach.get("amount") else ""
    return f"This month, focus on {str(coach.get('action', 'staying consistent')).lower()}. {coach.get('detail', '')}{amount}"


def _weekly_answer(copilot: dict[str, Any]) -> str:
    weekly = copilot.get("weeklyHealth") or {}
    improvements = weekly.get("improvementSuggestions") or []
    next_step = improvements[0] if improvements else "Keep your profile updated and review the plan monthly."
    return f"Your weekly financial health score is {weekly.get('score', 0)}/100 and the trend is {str(weekly.get('trend', 'not available')).lower()}. Next step: {next_step}"


def _focus_answer(profile: dict[str, Any], rec: dict[str, Any], portfolio: dict[str, Any], risks: list[str]) -> str:
    surplus = profile.get("monthlySurplus", 0)
    action = portfolio.get("summary", {}).get("topRebalancingAction") or "use new savings to keep your investments close to your suggested mix"
    main_risk = _clean_sentence((risks or [rec.get("primaryRisk") or rec.get("whatCanGoWrong", "normal market ups and downs")])[0])
    if not rec:
        return f"Your monthly surplus is about Rs {surplus:,.0f}. Start by updating your financial details, then refresh suggestions so your investments and goals use current information."
    return (
        f"This month, focus on {rec.get('instrumentName')} at about Rs {rec.get('suggestedMonthlyAmount', 0):,.0f}/month, "
        f"because it supports {rec.get('goalTag', 'your goals')} and has a {rec.get('convictionScore', rec.get('confidenceScore', 0))}% confidence level. "
        f"Suggested plan adjustment: {_clean_sentence(action)}. Main risk to watch: {main_risk}."
    )


def _recommendation_answer(rec: dict[str, Any], signal: dict[str, Any] | None, safety_note: str) -> str:
    if not rec:
        return "I do not have a matching active recommendation yet. Refresh recommendations after updating your profile and market research."
    signal_text = f" Market update: {signal.get('title')} - {signal.get('whyItMatters')}" if signal else ""
    return (
        f"{rec.get('instrumentName')} was suggested for {rec.get('goalTag', 'your goals')} with about {rec.get('suggestedAllocationPercentage', 0)}% of your investments "
        f"and about Rs {rec.get('suggestedMonthlyAmount', 0):,.0f}/month. "
        f"Reason: {_clean_sentence(rec.get('conciseReason') or rec.get('recommendationReasoning', {}).get('whyRecommended') or rec.get('userSpecificReasoning', ''))}. "
        f"Why it may be worth reviewing now: {_clean_sentence(rec.get('conciseTrigger') or rec.get('recommendationReasoning', {}).get('whyNow') or rec.get('marketRegimeSummary', ''))}. "
        f"Risk: {_clean_sentence(rec.get('primaryRisk') or rec.get('whatCanGoWrong', 'market risk applies'))}.{signal_text} {safety_note}"
    )


def _goal_answer(goals: list[dict[str, Any]], profile: dict[str, Any]) -> str:
    if not goals:
        return "I do not see saved goals yet. Add goals with priorities so recommendations can be matched to timelines."
    goal = sorted(goals, key=lambda item: item.get("feasibilityScore", 100))[0]
    surplus = profile.get("monthlySurplus", 0)
    needed = goal.get("requiredMonthlyInvestment", 0)
    status = "underfunded" if needed > surplus * 0.4 or goal.get("feasibilityScore", 100) < 60 else "reasonably on track"
    return f"{goal.get('name')} looks {status}. It needs about Rs {needed:,.0f}/month versus total surplus of Rs {surplus:,.0f}. Fund priority {goal.get('priority')} goals before adding short-term investment ideas."


def _portfolio_answer(portfolio: dict[str, Any], risks: list[str]) -> str:
    summary = portfolio.get("summary", {})
    warnings = risks or portfolio.get("riskWarnings", [])
    return (
        f"Your investment plan health is {summary.get('portfolioHealth', 0)}%. Your investments are spread out at a score of {summary.get('diversificationScore', 0)}%, "
        f"and they differ from your suggested mix by {summary.get('allocationDrift', 0)}%. "
        f"Suggested action: {summary.get('topRebalancingAction', 'use new savings for the areas that need more money')}. "
        f"Risk to watch: {(warnings or ['no urgent risk warning detected'])[0]}."
    )


def _market_answer(market: dict[str, Any], signals: list[dict[str, Any]]) -> str:
    regime = market.get("regime", {})
    signal = signals[0] if signals else {}
    return (
        f"Current market conditions: {regime.get('regimeName', 'limited data')} with {regime.get('confidenceScore', 0)}% confidence. "
        f"Suggested approach: {regime.get('recommendedPortfolioStance', 'avoid major investment changes until the information is refreshed')}. "
        f"Important update: {signal.get('title', 'no major market update is available')}. {signal.get('whyItMatters', '')}"
    )


def _matching_recommendation(message: str, recommendations: list[dict[str, Any]]) -> dict[str, Any] | None:
    for rec in recommendations:
        text = " ".join([rec.get("instrumentName", ""), rec.get("ticker", ""), rec.get("assetType", ""), rec.get("goalTag", "")]).lower()
        if any(token and token in text for token in message.split()):
            return rec
    return None


def _find_rec(recommendations: list[dict[str, Any]], term: str) -> dict[str, Any] | None:
    term = term.lower()
    return next((rec for rec in recommendations if term in " ".join([rec.get("instrumentName", ""), rec.get("assetType", ""), rec.get("strategyBucket", "")]).lower()), None)


def _find_signal(signals: list[dict[str, Any]], terms: list[str]) -> dict[str, Any] | None:
    for signal in signals:
        text = " ".join([signal.get("title", ""), signal.get("summary", ""), signal.get("signalType", "")]).lower()
        if any(term in text for term in terms):
            return signal
    return None


def _clean_sentence(value: Any) -> str:
    text = " ".join(str(value or "").split()).rstrip(" .")
    return text or "limited saved context"
