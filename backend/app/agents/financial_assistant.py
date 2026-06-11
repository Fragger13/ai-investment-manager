from app.schemas.financial import OnboardingProfile
from app.agents.recommendation_action_agent import generate_advanced_recommendations
from app.services.intelligence import build_dashboard


def answer(
    message: str,
    profile: OnboardingProfile,
    market_context: dict | None = None,
    asset_context: dict | None = None,
    validation_context: dict | None = None,
    portfolio_context: dict | None = None,
    memory_context: dict | None = None,
) -> str:
    dashboard = build_dashboard(profile)
    lower = message.lower()
    income = dashboard["summary"]["monthlyIncome"]
    expenses = dashboard["summary"]["monthlyExpenses"]
    surplus = dashboard["summary"]["investableSurplus"]
    savings_rate = dashboard["summary"]["savingsRate"]

    if _asks_about_strategy_validation(lower):
        return _answer_strategy_validation(lower, asset_context or {}, validation_context or {})
    if _asks_about_memory(lower):
        return _answer_memory(lower, memory_context or {})
    if _asks_about_portfolio_optimization(lower):
        return _answer_portfolio_optimization(lower, portfolio_context or {})
    if _asks_about_market_intelligence(lower):
        return _answer_market_intelligence(lower, market_context or {})
    if _asks_about_asset_intelligence(lower):
        return _answer_asset_intelligence(lower, asset_context or {})

    if "trip" in lower or "travel" in lower:
        travel_goal = next((goal for goal in dashboard["goals"] if goal["id"] == "goal-travel"), None)
        if not travel_goal or travel_goal["targetAmount"] <= 0:
            return "I need your travel assumptions first: number of domestic trips, international trips, and average cost per trip. Once entered, I can compare the yearly travel cost with your monthly surplus."
        affordable = travel_goal["requiredMonthlyInvestment"] <= surplus * 0.35
        return (
            f"Your yearly travel plan is about Rs {travel_goal['targetAmount']:,.0f}, or Rs {travel_goal['requiredMonthlyInvestment']:,.0f} per month. "
            f"Your current monthly surplus is Rs {surplus:,.0f}. "
            f"{'This looks affordable if other goals are already funded.' if affordable else 'This may stretch your budget, so reduce trip count or create a separate travel SIP.'}"
        )
    if "overspending" in lower or "spend" in lower or "expense" in lower:
        ratio = round(expenses / income * 100) if income else 0
        return (
            f"Your expenses are about {ratio}% of monthly inflow. A beginner-friendly target is to keep essential expenses and EMIs low enough that you can still save 20-30%. "
            f"Your current savings rate is {savings_rate:.1f}%. Start by reviewing subscriptions, lifestyle spends, and EMI commitments."
        )
    if "house" in lower or "emi" in lower:
        house = next((goal for goal in dashboard["goals"] if goal["id"] == "goal-house"), None)
        if not house:
            return "Enter a house target amount and choose either save-first or EMI mode. I will estimate monthly savings or EMI affordability."
        warning = f" Warning: {house['affordabilityWarning']}" if house.get("affordabilityWarning") else ""
        return (
            f"For the house goal, the estimated monthly requirement is Rs {house['requiredMonthlyInvestment']:,.0f}. "
            f"This should be compared with your monthly surplus of Rs {surplus:,.0f}.{warning}"
        )
    if "risk" in lower or "rebalance" in lower or "portfolio" in lower:
        allocation = ", ".join(f"{item['name']}: Rs {item['value']:,.0f}" for item in dashboard["allocation"][:5])
        return (
            f"Your main portfolio buckets are {allocation}. The system separates short-term risk comfort from long-term risk comfort. "
            "Use high-risk tactical ideas only after emergency money and core monthly investments are funded."
        )
    if _asks_about_advanced_recommendations(lower):
        advanced = generate_advanced_recommendations(profile)["recommendations"]
        if not advanced:
            return "I could not generate research-backed recommendations yet. Refresh research and complete your profile so I can use goals, risk, portfolio, and market regime together."
        rec = _matching_recommendation(lower, advanced)
        sources = ", ".join(source["name"] for source in rec.get("sourceLinks", [])[:4]) or "labelled internal/limited research layer"
        linked = rec.get("linkedGoals", [{}])[0]
        linked_goal = f"Priority {linked.get('priority')} goal: {linked.get('name')}" if linked else rec.get("goalTag", "your goals")
        ticker_suffix = f" ({rec.get('ticker')})" if rec.get("ticker") else ""
        if "confidence" in lower:
            breakdown = rec.get("confidenceBreakdown", {})
            components = ", ".join(f"{item.get('label')}: {item.get('score')}%" for item in breakdown.get("components", [])[:5])
            return (
                f"Confidence for {rec['instrumentName']} is {breakdown.get('overall', rec.get('confidenceScore'))}%. "
                f"Here is what supports that level: {components or 'details are not available yet'}. {breakdown.get('explanation', '')} "
                "Confidence is not a guarantee of returns."
            )
        if "contradict" in lower or "what can go wrong" in lower:
            contradiction = rec.get("contradictionAnalysis", {})
            items = "; ".join(item.get("summary", "") for item in contradiction.get("items", [])[:3]) or rec.get("whatCanGoWrong", "")
            return (
                f"Here is what could challenge {rec['instrumentName']}: {contradiction.get('summary', 'No direct concern is linked yet.')} "
                f"Main points: {items}. This is why the suggested amount stays limited and the idea should be reviewed."
            )
        if "weaker" in lower or "invalid" in lower:
            rules = rec.get("invalidationRules", [])
            text = "; ".join(f"{item.get('type')}: {item.get('trigger')}" for item in rules[:4]) or rec.get("invalidationTrigger", "")
            return f"{rec['instrumentName']} would become weaker if: {text}. If this happens, keep an eye on it, reduce the amount, or review it again before adding more."
        if "assumption" in lower:
            assumptions = rec.get("recommendationReasoning", {}).get("assumptions", [])
            return f"Main assumptions for {rec['instrumentName']}: {'; '.join(assumptions[:5]) or 'market conditions, supporting information, goal priority, and your comfort with risk remain broadly valid'}."
        if "allocation cap" in lower or "allocation capped" in lower:
            reasoning = rec.get("recommendationReasoning", {})
            return (
                f"The suggested amount is limited because this idea has {rec.get('riskLevel', 'Medium')} risk and should remain a small part of your investments. "
                f"{reasoning.get('allocationRationale', '')} Effect on your plan: {rec.get('allocationImpact', 'the effect is estimated from your current mix of investments')}."
            )
        if "which intelligence" in lower or "layers support" in lower or "support it" in lower:
            support = rec.get("committeeSupport", [])
            consensus = rec.get("consensus", {})
            return (
                f"{rec['instrumentName']} is supported by {', '.join(support) or 'limited linked information'}. "
                f"Agreement across checks is {consensus.get('agreementScore', 0)}%, supporting signals are {consensus.get('finalEvidenceScore', rec.get('evidenceScore', 0))}%, "
                f"and the final confidence level is {consensus.get('finalConviction', rec.get('convictionScore', 0))}%. "
                f"{consensus.get('summary', 'The app ranks this after checking several parts of your plan.')} This is not a promise of returns."
            )
        if "ranks above" in lower or "top recommendation" in lower or "why this became" in lower:
            consensus = rec.get("consensus", {})
            return (
                f"{rec['instrumentName']} ranks highly because it combines goal impact for {linked_goal}, "
                f"a balance-of-risk score of {rec.get('riskAdjustedScore', 0)}%, supporting signals of {rec.get('evidenceScore', 0)}%, "
                f"an effect on your plan ({rec.get('allocationImpact', 'the fit with your plan is estimated')}), and agreement across checks of {consensus.get('agreementScore', 0)}%. "
                "Ideas with weaker support or too much overlap stay on the keep-an-eye-on list."
            )
        if "tactical vs core" in lower or "tactical or core" in lower or "why is this tactical" in lower:
            return (
                f"{rec['instrumentName']} is classified as {rec.get('strategyBucket', rec.get('recommendationType', 'research-backed'))} because "
                f"{rec.get('keyTrigger') or rec.get('conciseTrigger') or rec.get('marketRegimeSummary', 'the current evidence changes its role in the portfolio')}. "
                f"Long-term ideas fund goals steadily. Short-term ideas stay smaller and are reviewed more often."
            )
        if "fit my goals" in lower or "goal" in lower:
            return (
                f"{rec['instrumentName']} fits {linked_goal}. "
                f"{rec.get('recommendationReasoning', {}).get('goalRationale', rec.get('userSpecificReasoning', ''))} "
                f"Timeline: {rec.get('timeHorizon')}. Funding gap considered: Rs {rec.get('goalFundingGap', 0):,.0f}."
            )
        if "regime works best" in lower or "best regime" in lower:
            validation = rec.get("historicalValidation") or rec.get("validation") or {}
            best = validation.get("regimePerformance", {}).get("bestRegime", "limited data")
            weak = validation.get("regimePerformance", {}).get("weakestRegime", "limited data")
            return f"For {rec['instrumentName']}, historical validation says best regime is {best} and weakest regime is {weak}. Current regime is {rec.get('marketRegime', 'unknown')}."
        return (
            f"{rec['instrumentName']}{ticker_suffix} is a {rec.get('recommendationType', 'research-backed')} idea for {linked_goal}. "
            f"Suggested size: {rec['suggestedAllocationPercentage']}%, about Rs {rec['suggestedMonthlyAmount']:,.0f}/month. "
            f"Why: {rec.get('conciseReason') or rec.get('recommendationReasoning', {}).get('whyRecommended', rec['userSpecificReasoning'])} "
            f"Why now: {rec.get('conciseTrigger') or rec.get('recommendationReasoning', {}).get('whyNow', rec.get('marketRegimeSummary', 'current signals are mixed'))}. "
            f"Main risk: {rec.get('primaryRisk') or rec.get('downsideScenario') or rec['whatCanGoWrong']} "
            f"Review trigger: {rec.get('invalidationTrigger') or rec.get('exitOrRebalanceCondition')}. "
            f"Conviction: {rec.get('convictionScore', rec.get('confidenceScore'))}%. Sources: {sources}. This is decision support, not a promise of returns."
        )
    advanced = generate_advanced_recommendations(profile)["recommendations"]
    if advanced:
        rec = sorted(advanced, key=lambda item: item["priorityOrder"])[0]
        return (
            f"Your investable surplus is about Rs {surplus:,.0f}/month. Focus first on {rec['instrumentName']} at about Rs {rec['suggestedMonthlyAmount']:,.0f}/month. "
            f"It supports {rec.get('goalTag', 'your goals')} and is sized using goal priority, portfolio risk budget, and the {rec.get('marketRegime', 'current')} market regime. "
            "Treat it as decision support and verify before acting."
        )
    return "Complete onboarding first so I can use your actual income, expenses, goals, risk comfort, and portfolio."


def _asks_about_advanced_recommendations(message: str) -> bool:
    keywords = [
        "source",
        "why are you recommending",
        "prioritize",
        "sip or lump",
        "what can go wrong",
        "stock",
        "share",
        "equity",
        "crypto",
        "bitcoin",
        "ethereum",
        "buy range",
        "allocation size",
        "market regime",
        "why now",
        "why not",
        "tactical",
        "conviction",
        "confidence low",
        "why is confidence",
        "contradicts this thesis",
        "contradict this thesis",
        "what contradicts this signal",
        "what contradicts this market signal",
        "what changed recently",
        "what would make this recommendation weaker",
        "allocation capped",
        "why is allocation capped",
        "assumptions",
        "fit my goals",
        "regime works best",
        "which intelligence",
        "layers support",
        "support it",
        "why this became",
        "top recommendation",
        "ranks above",
        "tactical vs core",
        "tactical or core",
        "why is this tactical",
    ]
    return any(keyword in message for keyword in keywords)


def _asks_about_market_intelligence(message: str) -> bool:
    keywords = [
        "market regime",
        "which sectors benefit",
        "sector benefit",
        "why is this signal",
        "what contradicts this signal",
        "what contradicts this market signal",
        "market signal",
        "geopolitical",
        "macro",
        "policy signal",
        "market intelligence",
        "which stocks may be affected",
        "how does this affect my recommendations",
        "how does this affect my goals",
    ]
    return any(keyword in message for keyword in keywords)


def _asks_about_asset_intelligence(message: str) -> bool:
    keywords = [
        "why this stock",
        "why this crypto",
        "underdog",
        "technical setup",
        "fundamentals",
        "high risk",
        "why is this watchlist",
        "why watchlist",
        "invalidate this thesis",
        "asset intelligence",
        "buy range",
        "stop-loss",
        "stop loss",
    ]
    return any(keyword in message for keyword in keywords)


def _asks_about_portfolio_optimization(message: str) -> bool:
    keywords = [
        "portfolio balanced",
        "overexposed",
        "over exposed",
        "target allocation",
        "crypto capped",
        "crypto cap",
        "tactical allocation limited",
        "tactical cap",
        "goals are underfunded",
        "rebalance now",
        "highest concentration risk",
        "allocation drift",
        "portfolio optimization",
    ]
    return any(keyword in message for keyword in keywords)


def _asks_about_memory(message: str) -> bool:
    keywords = [
        "why did this recommendation change",
        "recommendation change",
        "what changed in my portfolio",
        "what changed in the market",
        "am i drifting",
        "drifting from my plan",
        "goals are falling behind",
        "falling behind",
        "ignored repeatedly",
        "become weaker",
        "what should i review today",
        "since last review",
        "recommendation history",
        "financial memory",
    ]
    return any(keyword in message for keyword in keywords)


def _answer_memory(message: str, memory_context: dict) -> str:
    summary = memory_context.get("summary", {})
    alerts = memory_context.get("driftAlerts", [])
    history = memory_context.get("recommendationHistory", [])
    actions = memory_context.get("recentActions", [])
    latest = history[0] if history else {}
    if "ignored" in message:
        ignored = [item for item in actions if item.get("actionType") in {"rejected", "ignored", "dismissed"}]
        if not ignored:
            return "I do not see repeated ignored recommendations yet. As you reject, dismiss, or accept ideas, I will use that to reduce irrelevant suggestions without increasing unsafe risk."
        names = ", ".join(item.get("entityName", "recommendation") for item in ignored[:4])
        return f"You have ignored or rejected: {names}. I will treat repeated rejection as a preference signal, but I will not increase high-risk ideas just because of behavior."
    if "weaker" in message or "change" in message:
        if not latest:
            return "No recommendation version history exists yet. Generate recommendations once, then reassess them after market or profile changes."
        changed = latest.get("changedFields", [])
        changed_text = "; ".join(f"{item.get('label')}: {item.get('previous')} to {item.get('current')}" for item in changed[:4]) or latest.get("changeReason", "No material change recorded.")
        return (
            f"Latest tracked recommendation version is {latest.get('instrumentName')} v{latest.get('versionNumber')}. "
            f"Change note: {latest.get('changeReason')}. Changed fields: {changed_text}. "
            "A weaker recommendation is usually moved toward Watchlist when confidence, validation, or portfolio fit deteriorates."
        )
    if "portfolio" in message or "drift" in message:
        portfolio = memory_context.get("portfolioDrift", {})
        p_alerts = portfolio.get("alerts", alerts)
        if not p_alerts:
            return "I do not see a major portfolio drift alert right now. Keep reviewing allocation monthly because market movement and new contributions can still move you away from target."
        top = p_alerts[0]
        return f"Portfolio drift to review: {top.get('title')}. {top.get('summary')} Suggested response: {top.get('recommendation')}"
    if "goal" in message or "falling behind" in message:
        goal_alerts = [alert for alert in alerts if alert.get("driftType") == "goal"]
        if not goal_alerts:
            return "I do not see an open goal drift alert yet. Goals can fall behind when target dates approach, target amounts rise, or monthly surplus drops."
        top = goal_alerts[0]
        return f"Goal drift to review: {top.get('title')}. {top.get('summary')} Suggested response: {top.get('recommendation')}"
    review_items = [alert.get("title") for alert in alerts[:3]]
    if latest:
        review_items.append(f"{latest.get('instrumentName')} recommendation version {latest.get('versionNumber')}")
    return (
        f"Memory summary: {summary.get('memoryEventCount', 0)} events, {summary.get('recommendationVersionCount', 0)} recommendation versions, "
        f"{summary.get('openDriftAlertCount', 0)} open drift alerts. Review today: {', '.join(review_items) if review_items else 'no urgent adaptive item found'}."
    )


def _answer_portfolio_optimization(message: str, portfolio_context: dict) -> str:
    if not portfolio_context:
        return "Portfolio optimization is not ready yet. Save your profile and refresh portfolio optimization first."
    summary = portfolio_context.get("summary", {})
    suggestions = portfolio_context.get("rebalancingSuggestions", [])
    warnings = portfolio_context.get("riskWarnings", [])
    buckets = portfolio_context.get("bucketAllocations", [])
    top_bucket = max(buckets, key=lambda item: abs(item.get("gapPercentage", 0)), default={})
    if "crypto" in message:
        return (
            f"Digital assets are limited to {summary.get('cryptoAllocationCap', 0)}% because their prices can move sharply and they should not fund essential goals. "
            f"Your suggested higher-risk investment share is {next((b.get('targetPercentage', 0) for b in buckets if b.get('bucketKey') == 'crypto_high_risk'), 0)}%. "
            "This limit can rise only when emergency savings, goal funding, your habits, and market conditions allow it."
        )
    if "tactical" in message:
        return (
            f"Short-term ideas are limited to {summary.get('tacticalAllocationCap', 0)}% because they can reverse quickly. "
            "Weak past results or cautious markets reduce the limit. New short-term ideas should replace weaker ones instead of adding more risk."
        )
    if "rebalance" in message:
        action = suggestions[0] if suggestions else {}
        return (
            f"Top suggested change: {action.get('title', 'No urgent adjustment')}."
            f" {action.get('explanation', 'Your investments are close enough to the suggested mix for now.')} "
            f"Suggested monthly amount: Rs {action.get('monthlyAmount', 0):,.0f}. Use new savings before selling unless too much money clearly depends on one area."
        )
    if "concentration" in message or "overexposed" in message or "over exposed" in message:
        return (
            f"The biggest difference from your suggested plan is in {top_bucket.get('bucketName', 'an unknown area')}: current {top_bucket.get('currentPercentage', 0)}%, "
            f"suggested {top_bucket.get('targetPercentage', 0)}%, difference {top_bucket.get('gapPercentage', 0)}%. "
            f"Your spread-out score is {summary.get('concentrationScore', 0)}%. "
            f"{warnings[0] if warnings else 'No major warning about depending on one area is active.'}"
        )
    return (
        f"Your investment-plan health is {summary.get('portfolioHealth', 0)}%. The suggested mix is built for your {summary.get('riskProfile', 'balanced')} comfort with risk "
        f"during {summary.get('marketRegime', 'balanced')} market conditions. Your spread-out score is {summary.get('diversificationScore', 0)}%, "
        f"your dependence-on-a-few-areas score is {summary.get('concentrationScore', 0)}%, your ups-and-downs score is {summary.get('volatilityScore', 0)}, "
        f"and your goal-match score is {summary.get('goalAlignmentScore', 0)}%. Top action: {summary.get('topRebalancingAction', 'review monthly savings')}."
    )


def _asks_about_strategy_validation(message: str) -> bool:
    keywords = [
        "historically worked",
        "historical",
        "backtest",
        "win rate",
        "benchmark",
        "reliable",
        "reliability",
        "historical downside",
        "max drawdown",
        "what regime performs best",
        "regime performs best",
        "why is this only a watchlist",
    ]
    return any(keyword in message for keyword in keywords)


def _answer_strategy_validation(message: str, asset_context: dict, validation_context: dict) -> str:
    assets = asset_context.get("assets", [])
    strategies = validation_context.get("strategies", [])
    benchmarks = validation_context.get("benchmarks", [])
    reliability = validation_context.get("reliability", [])
    asset = _matching_asset(message, assets) if assets else {}
    row = _matching_validation_row(asset, strategies) if asset else (strategies[0] if strategies else {})
    benchmark = _matching_validation_row(asset, benchmarks) if asset else (benchmarks[0] if benchmarks else {})
    signal = reliability[0] if reliability else {}
    if not row:
        return "Historical validation has not been generated yet. Refresh Strategy Lab validation first, then I can explain win rate, drawdown, benchmark comparison, and regime fit."
    return (
        f"Historical validation for {row.get('assetName', asset.get('assetName', 'this setup'))} is {row.get('qualityScore', 0)}% quality with "
        f"{row.get('sampleSize', 0)} comparable setup samples. Win rate: {row.get('winRate', 0)}%; average return over the tested holding period: "
        f"{row.get('averageReturn', 0)}%; max historical drawdown in the price series: {row.get('maxDrawdown', 0)}%. "
        f"Benchmark check: {benchmark.get('notes', 'benchmark comparison is not available yet')} "
        f"Signal reliability context: {signal.get('notes', 'signal reliability is pending')}. "
        "This is historical evidence only, not a guarantee. Weak samples or poor benchmark-relative behavior should keep an idea as Watchlist or reduce sizing."
    )


def _answer_asset_intelligence(message: str, asset_context: dict) -> str:
    assets = asset_context.get("assets", [])
    if not assets:
        return "Asset intelligence is not ready yet. Refresh asset research so I can review technicals, fundamentals, liquidity, risk, and evidence."
    asset = _matching_asset(message, assets)
    tech = asset.get("technical") or {}
    fund = asset.get("fundamental") or {}
    liq = asset.get("liquidity") or {}
    risk = asset.get("risk") or {}
    alpha = asset.get("alpha") or {}
    crypto = asset.get("crypto") or {}
    action = "Watchlist"
    if "accumulate" in asset.get("category", "").lower() or alpha.get("suggestedAction") == "accumulate" or crypto.get("recommendedAction") == "accumulate":
        action = "Accumulate gradually"
    if "avoid" in asset.get("category", "").lower():
        action = "Avoid"
    reason = alpha.get("nonObviousReason") or crypto.get("narrative") or asset.get("summary", "")
    return (
        f"{asset.get('assetName')} ({asset.get('ticker') or asset.get('assetType')}) is currently classified as {action}. "
        f"Why it is interesting: {reason} "
        f"Technical setup: trend strength {tech.get('trendStrength', 0)}%, buy range {tech.get('buyRange', 'limited data')}, review zone {tech.get('reviewZone', 'limited data')}. "
        f"Fundamentals: score {fund.get('fundamentalScore', 0)}%, data completeness {fund.get('dataCompleteness', 'limited')}; revenue/profit figures are not faked and need latest filing verification where marked limited. "
        f"Risk: {risk.get('riskCategory', 'not classified')} with liquidity score {liq.get('liquidityScore', 0)}%. "
        f"What invalidates it: {alpha.get('invalidationTrigger') or tech.get('stopLossReference') or 'sector signal weakens, liquidity dries up, or company-specific risk worsens.'} "
        "This is decision support. Technical signals can fail, and watchlist is not a buy recommendation."
    )


def _answer_market_intelligence(message: str, market_context: dict) -> str:
    regime = market_context.get("regime", {})
    signals = market_context.get("signals", [])
    if not regime:
        return "Market updates are not ready yet. Refresh them first so I can use current information from saved sources."
    top_signal = _matching_market_signal(message, signals)
    drivers = ", ".join(regime.get("drivers", [])[:3]) or "mixed market evidence"
    if "market regime" in message:
        return (
            f"Current market conditions are {regime.get('regimeName', 'limited-data')} with about {regime.get('confidenceScore', 0)}% confidence. "
            f"Main reasons: {drivers}. Suggested approach: {regime.get('recommendedPortfolioStance', 'Keep your investments spread out and use checked information.')} "
            "This is decision support, not a guarantee about market direction."
        )
    if top_signal:
        beneficiaries = ", ".join(top_signal.get("likelyBeneficiaries", [])[:5]) or "not clearly classified"
        losers = ", ".join(top_signal.get("likelyLosers", [])[:5]) or "not clearly classified"
        affected = ", ".join(top_signal.get("relevantInstruments", [])[:5]) or ", ".join(top_signal.get("affectedAssets", [])[:5]) or "broad market"
        conflicts = top_signal.get("conflictingEvidence", [])
        explainability = top_signal.get("explainability", {})
        conflict_text = explainability.get("contradictionExplanation") or (conflicts[0].get("summary") if conflicts else "No strong contradiction is currently linked.")
        related = ", ".join(top_signal.get("relatedRecommendations", [])[:3]) or "No recommendation is directly linked yet."
        return (
            f"Update: {top_signal.get('title', 'Market update')}. It matters because {explainability.get('whySignalMatters') or top_signal.get('whyItMatters', top_signal.get('summary', 'it can affect when you invest'))} "
            f"Who may benefit: {beneficiaries}. Who may face challenges: {losers}. Related investments: {affected}. "
            f"Confidence note: {explainability.get('confidenceExplanation', 'confidence combines source quality and the strength of this update')}. "
            f"What could challenge it: {conflict_text} Related suggestions: {related}. "
            "Use this as information to review, not as a buy-or-sell instruction by itself."
        )
    return (
        f"Current market conditions are {regime.get('regimeName', 'limited-data')}. "
        f"Main reasons: {drivers}. {regime.get('recommendedPortfolioStance', '')} "
        "Ask about a specific sector, share, update, or suggestion and I can explain the supporting information."
    )


def _matching_market_signal(message: str, signals: list[dict]) -> dict | None:
    if not signals:
        return None
    lowered = message.lower()
    for signal in signals:
        haystack = " ".join(
            [
                signal.get("title", ""),
                signal.get("summary", ""),
                signal.get("signalType", ""),
                " ".join(signal.get("likelyBeneficiaries", [])),
                " ".join(signal.get("likelyLosers", [])),
                " ".join(signal.get("relevantInstruments", [])),
            ]
        ).lower()
        if any(token and token in haystack for token in lowered.split()):
            return signal
    return signals[0]


def _matching_asset(message: str, assets: list[dict]) -> dict:
    lowered = message.lower()
    tokens = [
        token
        for token in lowered.replace("?", " ").replace(",", " ").split()
        if len(token) >= 3
        and token
        not in {
            "the",
            "and",
            "for",
            "why",
            "what",
            "this",
            "that",
            "setup",
            "technical",
            "fundamental",
            "fundamentals",
            "watchlist",
            "buy",
            "stock",
            "crypto",
            "asset",
            "high",
            "risk",
        }
    ]
    for asset in assets:
        name = asset.get("assetName", "").lower()
        ticker = asset.get("ticker", "").lower().replace(".ns", "")
        if (name and name in lowered) or (ticker and ticker in lowered):
            return asset
    for asset in assets:
        haystack = f"{asset.get('assetName', '')} {asset.get('ticker', '')} {asset.get('assetType', '')} {asset.get('category', '')}".lower()
        if tokens and any(token in haystack for token in tokens):
            return asset
    if "crypto" in lowered:
        match = next((asset for asset in assets if "crypto" in asset.get("assetType", "").lower()), None)
        if match:
            return match
    if "underdog" in lowered:
        match = next((asset for asset in assets if (asset.get("alpha") or {}).get("bucket") == "underdog"), None)
        if match:
            return match
    return assets[0]


def _matching_validation_row(asset: dict, rows: list[dict]) -> dict:
    if not rows:
        return {}
    name = (asset.get("assetName") or "").lower()
    ticker = (asset.get("ticker") or "").lower().replace(".ns", "")
    for row in rows:
        row_name = (row.get("assetName") or "").lower()
        row_symbol = (row.get("assetSymbol") or "").lower().replace(".ns", "")
        if (name and name == row_name) or (ticker and ticker == row_symbol):
            return row
    return rows[0]


def _matching_recommendation(message: str, recommendations: list[dict]) -> dict:
    lowered = message.lower()
    if "crypto" in lowered or "bitcoin" in lowered or "btc" in lowered:
        match = next((rec for rec in recommendations if rec.get("assetType") == "Crypto asset" or rec.get("ticker") in {"BTC", "ETH"}), None)
        if match:
            return match
    if "stock" in lowered or "share" in lowered or "equity" in lowered:
        match = next((rec for rec in recommendations if rec.get("assetType") == "Equity share"), None)
        if match:
            return match
    if "tactical" in lowered:
        match = next((rec for rec in recommendations if rec.get("recommendationType") == "Tactical"), None)
        if match:
            return match
    for rec in recommendations:
        haystack = f"{rec.get('instrumentName', '')} {rec.get('ticker', '')} {rec.get('assetType', '')}".lower()
        if any(part and part in haystack for part in lowered.split()):
            return rec
    return sorted(recommendations, key=lambda item: item["priorityOrder"])[0]
