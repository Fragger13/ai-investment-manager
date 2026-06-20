from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.agents.alpha_discovery_agent import discover_alpha_assets
from app.agents.asset_relationship_graph_agent import related_recommendation_candidates, relationship_explanation
from app.agents.asset_screening_agent import screen_assets_for_institutional_engine
from app.agents.candidate_selection_agent import candidate_lookup, select_investment_candidates
from app.agents.contrarian_opportunity_agent import identify_contrarian_setup
from app.agents.conviction_scoring_agent import score_conviction
from app.agents.crypto_narrative_agent import analyze_crypto_narrative
from app.agents.dynamic_stock_ranking_agent import rank_stock_candidate
from app.agents.evidence_scoring_agent import build_evidence_items, score_evidence
from app.agents.explainability_agent import enrich_recommendation_explainability
from app.agents.factor_analysis_agent import analyze_investor_factors
from app.agents.fundamental_analysis_agent import analyze_fundamentals
from app.agents.geopolitical_risk_agent import assess_geopolitical_risk
from app.agents.goal_allocation_agent import build_goal_hierarchy, select_goal_for_asset
from app.agents.investment_knowledge_graph_agent import build_investment_knowledge_graph
from app.agents.investor_profile_clustering_agent import assign_investor_cluster
from app.agents.macro_event_interpreter_agent import best_event_for_asset, interpret_macro_events
from app.agents.market_regime_agent import assess_market_regime
from app.agents.master_orchestrator_agent import consolidate_recommendation_response
from app.agents.model_validation_agent import validate_recommendation_batch
from app.agents.portfolio_construction_agent import construct_portfolio
from app.agents.portfolio_suitability_agent import analyze_asset_fit_with_context
from app.agents.position_sizing_agent import size_position
from app.agents.recommendation_re_ranking_agent import apply_quality_gates, rerank_recommendations, score_final_recommendation
from app.agents.sector_rotation_agent import detect_sector_rotation, sector_score_for_asset
from app.agents.sentiment_analysis_agent import analyze_sentiment
from app.agents.strategy_reliability_agent import summarize_strategy_reliability
from app.agents.tactical_allocation_agent import build_tactical_overlay
from app.agents.tactical_validation_agent import validate_recommendation_tactics
from app.agents.technical_analysis_agent import analyze_technicals
from app.agents.timing_intelligence_agent import build_timing_plan
from app.models.alpha_opportunity import AlphaOpportunity
from app.models.asset_liquidity_score import AssetLiquidityScore
from app.models.asset_risk_score import AssetRiskScore
from app.models.crypto_asset_research import CryptoAssetResearch
from app.models.fundamental_metric import FundamentalMetric
from app.models.technical_indicator import TechnicalIndicator
from app.schemas.financial import OnboardingProfile
from app.services.intelligence import DISCLAIMER
from app.services.backtesting_service import initialize_recommendation_performance, model_metadata
from app.services.optimization.portfolio_optimizer import optimize_portfolio
from app.services.recommendations.asset_screening_service import signals_for_asset
from app.services.recommendations.goal_funding_service import solve_goal_funding
from app.services.recommendations.recommendation_builder import build_recommendation
from app.services.recommendations.suitability_scoring_service import build_profile_context
from app.services.research.fund_factor_service import (
    category_candidates,
    category_percentiles,
    diversification_insight,
    expected_return_from_factors,
    score_fund,
)
from app.services.research.fund_research_service import category_key_for_name
from app.services.research.equity_factor_service import (
    equity_factors,
    equity_universe,
    ticker_from_constituents,
)
from app.services.research.crypto_factor_service import (
    crypto_ticker_for_name,
    crypto_universe,
    factors_for_symbol,
)


def generate_institutional_recommendations(db: Session, profile: OnboardingProfile | None = None) -> dict:
    profile = profile or OnboardingProfile()
    context = build_profile_context(profile)
    goals = build_goal_hierarchy(profile)
    funding = solve_goal_funding(profile)
    holding_codes = [h.schemeCode for h in (profile.holdings or []) if getattr(h, "schemeCode", "")]
    selected_fund_codes: list[str] = []
    factors = analyze_investor_factors(context, goals)
    cluster = assign_investor_cluster(factors)
    assets, signals = screen_assets_for_institutional_engine(db, goals, {"regime": "balanced"})
    regime = assess_market_regime(signals)
    assets, signals = screen_assets_for_institutional_engine(db, goals, regime)
    alpha_assets = discover_alpha_assets({asset.instrument_name for asset in assets}, signals, context, regime)
    assets.extend(alpha_assets)
    candidates = select_investment_candidates(assets, signals, goals, cluster)
    candidates_by_name = candidate_lookup(candidates)
    graph = build_investment_knowledge_graph(goals, assets, signals)
    macro_events = interpret_macro_events(signals)
    geopolitical = assess_geopolitical_risk(signals)
    sector_rotation = detect_sector_rotation(signals)
    portfolio_plan = construct_portfolio(profile, context, goals, regime)
    portfolio_optimization = optimize_portfolio(db, profile, persist=False)

    recommendations = []
    asset_key_counts: dict[str, int] = {}
    max_by_key = _asset_count_caps(cluster)
    for asset in assets:
        if asset_key_counts.get(asset.asset_key, 0) >= max_by_key.get(asset.asset_key, 1):
            continue
        candidate = candidates_by_name.get(asset.instrument_name)
        supporting, conflicting = signals_for_asset(asset, signals)
        fit = analyze_asset_fit_with_context(context, asset, supporting, conflicting)
        if fit["suitabilityScore"] < 42:
            continue
        goal = select_goal_for_asset(asset.asset_key, goals)
        # For fund assets, pick the specific scheme per the user's profile/goal
        # using the risk-adjusted factor engine + diversification vs holdings,
        # and let the fund's real quality move its suitability.
        fund_choice = _personalize_fund(asset, context, goal, selected_fund_codes, holding_codes, regime)
        if not fund_choice:
            fund_choice = _personalize_equity(asset, context, goal, regime) or _personalize_crypto(asset, context, goal, regime)
        if fund_choice:
            fit["suitabilityScore"] = max(5, min(96, round(fit["suitabilityScore"] + (fund_choice["score"] - 50) * 0.25)))
        sizing = size_position(context, asset, goal, portfolio_plan, regime)
        if sizing["suggestedAllocationPercentage"] <= 0 or sizing["suggestedMonthlyAmount"] <= 0:
            continue
        fit = {**fit, **sizing, "assetCategory": asset.category}
        if any(term in asset.category.lower() for term in ["underdog", "event-driven"]):
            cap = min(cluster["smallMidCapAllocationCap"], 3) if "underdog" in asset.category.lower() else min(cluster["tacticalAllocationCap"], 6)
            fit["suggestedAllocationPercentage"] = min(fit["suggestedAllocationPercentage"], cap)
            fit["suggestedMonthlyAmount"] = min(fit["suggestedMonthlyAmount"], round(context.surplus * cap / 100))
        if asset.asset_key == "crypto":
            fit["suggestedAllocationPercentage"] = min(fit["suggestedAllocationPercentage"], cluster["cryptoAllocationCap"])
            fit["suggestedMonthlyAmount"] = min(fit["suggestedMonthlyAmount"], round(context.surplus * cluster["cryptoAllocationCap"] / 100))
        if fit["suggestedAllocationPercentage"] <= 0 and candidate and candidate["bucket"] != "watchlist":
            continue
        base = build_recommendation(profile, context, asset, signals, len(recommendations) + 1, fit_override=fit)
        if not base:
            continue
        timing = build_timing_plan(asset, regime, supporting, conflicting)
        tactical = build_tactical_overlay(asset, regime, supporting, conflicting)
        fundamental = analyze_fundamentals(asset)
        technical = analyze_technicals(asset, regime, supporting, conflicting)
        asset_intelligence = _asset_intelligence_snapshot(db, asset)
        fundamental = _overlay_fundamental(fundamental, asset_intelligence)
        technical = _overlay_technical(technical, asset_intelligence)
        contrarian = identify_contrarian_setup(asset, supporting, conflicting, regime)
        crypto_narrative = analyze_crypto_narrative(asset, context, signals) if asset.asset_key == "crypto" else {}
        crypto_narrative = _overlay_crypto_narrative(crypto_narrative, asset_intelligence)
        macro_event = best_event_for_asset(asset.instrument_name, asset.category, macro_events)
        sector_score = sector_score_for_asset(asset.instrument_name, asset.category, sector_rotation)
        sentiment = analyze_sentiment(asset.instrument_name, asset.asset_key, signals)
        stock_rank = rank_stock_candidate(asset, fundamental, technical, sentiment, regime) if asset.asset_key in {"equity", "tactical", "crypto"} else None
        conviction = score_conviction(asset, fit, goal, regime, supporting, conflicting, tactical)
        historical_validation = validate_recommendation_tactics(db, _validation_asset(asset, base), base, regime)
        enriched = _enrich(
            base,
            fit,
            goal,
            regime,
            portfolio_plan,
            timing,
            tactical,
            conviction,
            fundamental,
            technical,
            contrarian,
            crypto_narrative,
            macro_event,
            geopolitical,
            sector_rotation,
            sector_score,
            candidate,
            cluster,
            factors,
            sentiment,
            stock_rank,
            graph,
            historical_validation,
            portfolio_optimization,
            asset_intelligence,
            fund_choice=fund_choice,
        )
        recommendations.append(enriched)
        asset_key_counts[asset.asset_key] = asset_key_counts.get(asset.asset_key, 0) + 1
        if len(recommendations) >= 15:
            break

    recommendations = rerank_recommendations(recommendations)
    _apply_goal_funding(recommendations, funding)
    for index, recommendation in enumerate(recommendations, start=1):
        recommendation["priorityOrder"] = index

    timestamp = datetime.now(UTC).isoformat(timespec="seconds")
    validation = validate_recommendation_batch(recommendations)
    modes = [rec["dataMode"] for rec in recommendations]
    data_mode = "live" if "live" in modes else "cached" if "cached" in modes else "delayed" if "delayed" in modes else "limited" if "limited" in modes else "fallback"
    result = {
        "recommendations": recommendations,
        "signals": [_compact_signal(signal) for signal in signals[:60]],
        "assets": [_asset_response(asset) for asset in assets[:40]],
        "dataMode": data_mode,
        "lastResearchedAt": timestamp,
        "sourceCount": len({source["url"] for rec in recommendations for source in rec.get("sourceLinks", [])}),
        "disclaimer": DISCLAIMER,
        "validationSummary": validation,
        "investorCluster": cluster,
        "factorScores": factors,
        "goalFunding": funding,
    }
    return consolidate_recommendation_response(result)


def _personalize_fund(asset, context, goal: dict, selected_codes: list[str], holding_codes: list[str], regime: dict) -> dict | None:
    """Pick the specific fund for a category using the factor engine + the user's
    profile/goal + diversification vs existing holdings. Mutates the asset's
    instrument name to the chosen scheme. Returns None for non-fund assets."""
    key = category_key_for_name(asset.category)
    if not key:
        return None
    candidates = category_candidates(key)
    if not candidates:
        return None
    pcts = category_percentiles(candidates)
    best: tuple | None = None
    best_total: float | None = None
    for cand in candidates:
        scored = score_fund(cand, pcts.get(cand["schemeCode"], {}), context, goal)
        div = diversification_insight(cand["schemeCode"], holding_codes, selected_codes)
        total = scored["score"] + div["scoreDelta"]
        if best_total is None or total > best_total:
            best_total, best = total, (cand, scored, div)
    if not best:
        return None
    cand, scored, div = best
    asset.instrument_name = f"{cand['name']} ({cand.get('plan', 'Direct - Growth')})"
    selected_codes.append(cand["schemeCode"])
    return {
        "factors": cand,
        "score": scored["score"],
        "drivers": scored["drivers"],
        "insights": scored["insights"],
        "diversification": div,
        "expectedReturn": expected_return_from_factors(cand, key, regime),
        "categoryKey": key,
    }


def _personalize_equity(asset, context, goal: dict, regime: dict) -> dict | None:
    """Attach real factor analysis + factor-based expected return to an equity
    stock asset (sourced live from the NSE universe). The stock is the asset, so
    no re-pick; its factors move its suitability. Returns None for non-stocks."""
    if asset.asset_key not in {"equity", "tactical"} or category_key_for_name(asset.category):
        return None
    ticker = ticker_from_constituents(asset.instrument_name)
    if not ticker:
        return None
    factors = equity_factors(ticker, asset.instrument_name, asset.category)
    if not factors:
        return None
    universe = equity_universe()
    pcts = category_percentiles(universe) if universe else {}
    scored = score_fund(factors, pcts.get(factors["schemeCode"], {}), context, goal)
    return {
        "factors": factors,
        "score": scored["score"],
        "drivers": scored["drivers"],
        "insights": scored["insights"],
        "diversification": {},
        "expectedReturn": expected_return_from_factors(factors, "equity_stock", regime),
        "categoryKey": "equity_stock",
    }


def _personalize_crypto(asset, context, goal: dict, regime: dict) -> dict | None:
    """Attach real factor analysis + factor-based expected return to a crypto
    asset (sourced live from the CoinGecko top-market-cap universe)."""
    if asset.asset_key != "crypto":
        return None
    factors = factors_for_symbol(asset.instrument_name, asset.instrument_name)
    if not factors:
        return None
    universe = crypto_universe()
    pcts = category_percentiles(universe) if universe else {}
    scored = score_fund(factors, pcts.get(factors["schemeCode"], {}), context, goal)
    return {
        "factors": factors,
        "score": scored["score"],
        "drivers": scored["drivers"],
        "insights": scored["insights"],
        "diversification": {},
        "expectedReturn": expected_return_from_factors(factors, "crypto", regime),
        "categoryKey": "crypto",
    }


def _fund_market_reasoning(fund_choice: dict) -> str:
    """Plain-language, numbers-grounded reasoning for the chosen fund."""
    f = fund_choice["factors"]
    div = fund_choice.get("diversification", {})
    bits = []
    if f.get("sortino") is not None:
        bits.append(f"Sortino {f['sortino']}")
    if f.get("maxDrawdown3y") is not None:
        bits.append(f"worst 3y drawdown {f['maxDrawdown3y']}%")
    if f.get("alpha") is not None:
        bits.append(f"alpha {f['alpha']}% vs Nifty 50")
    if f.get("downCapture") is not None:
        bits.append(f"down-capture {f['downCapture']}")
    metric_clause = f" ({', '.join(bits)})" if bits else ""
    parts = [f"{f['name']} was selected on risk-adjusted quality, not just past return{metric_clause}."]
    drivers = fund_choice.get("drivers", [])
    if drivers:
        parts.append(drivers[0] + ".")
    corr = div.get("correlationToHoldings")
    if div.get("diversifies") and corr is not None:
        parts.append(f"It is only {corr} correlated to your existing holdings, so it improves diversification.")
    elif div.get("redundant"):
        parts.append("Note: it overlaps heavily with another pick, so treat them as one position.")
    return " ".join(parts)


def _apply_goal_funding(recommendations: list[dict], funding: dict) -> None:
    """Attach each goal's funding status (required SIP, funding %, gap, fix) to
    its recommendations, so the user sees whether the plan reaches the goal and
    what to change if not. Per-asset SIPs keep the surplus-based glide-path
    sizing; the funding plan reports the honest required-vs-allocated picture."""
    plans = {p["name"]: p for p in funding.get("goals", [])}
    for rec in recommendations:
        plan = plans.get(rec.get("goalTag", ""))
        if not plan:
            continue
        rec["goalFunding"] = {
            "fundingPercent": plan["fundingPercent"],
            "requiredMonthlyInvestment": plan["requiredMonthlyInvestment"],
            "allocatedMonthlyInvestment": plan["allocatedMonthlyInvestment"],
            "gap": plan["gap"],
            "onTrack": plan["onTrack"],
            "fix": plan["fix"],
            "timeHorizonMonths": plan["timeHorizonMonths"],
        }


def _enrich(
    base: dict,
    fit: dict,
    goal: dict,
    regime: dict,
    portfolio_plan: dict,
    timing: dict,
    tactical: dict,
    conviction: dict,
    fundamental: dict,
    technical: dict,
    contrarian: dict,
    crypto_narrative: dict,
    macro_event: dict | None,
    geopolitical: dict,
    sector_rotation: dict,
    sector_score: int,
    candidate: dict | None,
    cluster: dict,
    factors: dict,
    sentiment: dict,
    stock_rank: dict | None,
    graph: dict,
    historical_validation: dict,
    portfolio_optimization: dict,
    asset_intelligence: dict,
    fund_choice: dict | None = None,
) -> dict:
    base["suggestedMonthlyAmount"] = fit["suggestedMonthlyAmount"]
    base["suggestedAllocationPercentage"] = fit["suggestedAllocationPercentage"]
    base["goalTag"] = goal["name"]
    base["ticker"] = _ticker_for(base["instrumentName"])
    base["recommendationType"] = _recommendation_type(fit["assetKey"], base["assetType"], base["instrumentName"], base.get("currentMarketReasoning", ""), fit.get("assetCategory", ""))
    base["linkedGoals"] = [
        {
            "priority": goal["priority"],
            "name": goal["name"],
            "type": goal["type"],
            "fundingGap": goal["fundingGap"],
            "timeHorizonMonths": goal["timeHorizonMonths"],
            "essential": goal["essential"],
        }
    ]
    base["timeHorizon"] = f"{goal['horizonBucket']} · {goal['timeHorizonMonths']} months"
    base["entryApproach"] = timing["entryApproach"]
    base["accumulationStrategy"] = timing["entryApproach"]
    base["idealAccumulationZone"] = technical.get("buyZone") or timing["buyRange"]
    base["reviewDate"] = _review_date_from_cadence(timing["reviewCadence"])
    base["exitOrRebalanceCondition"] = tactical["rebalanceLogic"]
    base["whyNow"] = regime["summary"]
    if fund_choice and fund_choice.get("expectedReturn"):
        # Forward estimate derived from the fund's own NAV history, not a static table.
        base["expectedReturn"] = fund_choice["expectedReturn"]
    else:
        base["expectedReturn"] = _expected_return(fit["assetKey"], base["assetType"], base["recommendationType"], regime, tactical)
    base["confidenceScore"] = min(95, max(base["confidenceScore"], round((base["confidenceScore"] + conviction["convictionScore"]) / 2)))
    base["suitabilityScore"] = fit["suitabilityScore"]
    base["marketRegime"] = regime["regime"]
    base["marketRegimeSummary"] = regime["summary"]
    base["goalPriority"] = goal["priority"]
    base["goalTimeHorizonMonths"] = goal["timeHorizonMonths"]
    base["goalFundingGap"] = goal["fundingGap"]
    base["essentialGoal"] = goal["essential"]
    base["portfolioRole"] = _portfolio_role(fit["assetKey"], goal)
    base["portfolioConstruction"] = portfolio_plan
    base.update(_portfolio_optimization_fields(fit["assetKey"], base, portfolio_optimization))
    base["positionSizing"] = {
        "note": fit["positionSizingNote"],
        "maxSinglePositionPercent": fit["maxSinglePositionPercent"],
    }
    base["tacticalView"] = tactical["tacticalView"]
    base["tacticalScore"] = tactical["tacticalScore"]
    base["timingPlan"] = timing
    base["buyRange"] = technical.get("buyZone") or timing["buyRange"]
    base["sellRange"] = technical.get("reviewZone") or timing["sellRange"]
    base["tacticalHorizon"] = timing["reviewCadence"]
    base["longTermHorizon"] = base["timeHorizon"]
    base["stopLossLogic"] = tactical["stopLossLogic"]
    base["rebalanceLogic"] = tactical["rebalanceLogic"]
    base["reviewCadence"] = timing["reviewCadence"]
    base["convictionScore"] = conviction["convictionScore"]
    base["convictionLabel"] = conviction["convictionLabel"]
    base["convictionDrivers"] = conviction["convictionDrivers"]
    base["riskBudget"] = portfolio_plan["riskBudget"]
    base["concentrationImpact"] = _concentration_impact(fit["assetKey"], fit["suggestedAllocationPercentage"])
    base["volatilityWarning"] = _volatility_warning(fit["assetKey"])
    base["downsideScenario"] = base["whatCanGoWrong"]
    evidence_items = build_evidence_items(base["instrumentName"], base.get("sourceLinks", []), base.get("supportingSignals", []), base.get("contradictorySignals", []), base["dataTimestamp"])
    evidence_meta = score_evidence(evidence_items, len(base.get("contradictorySignals", [])), "low" if base.get("dataMode") == "limited" else "medium")
    scores = _opportunity_scores(base, fit, conviction, supporting_count=len(base.get("supportingSignals", [])), conflicting_count=len(base.get("contradictorySignals", [])), fundamental=fundamental, technical=technical, contrarian=contrarian, macro_event=macro_event, sector_score=sector_score)
    base.update(scores)
    _apply_asset_intelligence_boosts(base, asset_intelligence)
    base["historicalValidation"] = historical_validation
    base["strategyReliability"] = summarize_strategy_reliability(historical_validation)
    base["validationScore"] = historical_validation.get("historicalReliability", 0)
    base["validationAdjustment"] = {
        "convictionAdjustment": historical_validation.get("convictionAdjustment", 0),
        "allocationMultiplier": historical_validation.get("allocationMultiplier", 1),
        "actionAdjustment": historical_validation.get("actionAdjustment", ""),
        "downgradeReason": historical_validation.get("downgradeReason", ""),
    }
    _apply_validation_adjustment(base, historical_validation)
    base["evidenceScore"] = evidence_meta["evidenceScore"]
    base["sourceCount"] = evidence_meta["sourceCount"]
    base["action"] = _action_for(base, crypto_narrative)
    _apply_asset_intelligence_action_gates(base, asset_intelligence)
    base["strategyBucket"] = _strategy_bucket(base, fit["assetKey"], contrarian, macro_event, crypto_narrative)
    if asset_intelligence and base["strategyBucket"] not in {"Defensive", "Crypto"}:
        base["strategyBucket"] = "Tactical" if base["recommendationType"] != "Watchlist" else "Watchlist"
    base["keyTrigger"] = _key_trigger(base, macro_event, technical, sector_rotation)
    base["whyThisMatters"] = _shorten(_why_this_matters(base, macro_event, contrarian, crypto_narrative), 150)
    base["thesisBullets"] = _thesis_bullets(base, macro_event, fundamental, technical, contrarian, crypto_narrative)
    base["riskBullets"] = _risk_bullets(base, crypto_narrative)
    base["evidencePoints"] = _evidence_points(base, evidence_items)
    base["strictAllocationCap"] = _strict_allocation_cap(fit["assetKey"], base["recommendationType"], crypto_narrative, fit["suggestedAllocationPercentage"])
    base["invalidationTrigger"] = _invalidation_trigger(fit["assetKey"], technical, macro_event)
    final_score = score_final_recommendation(base, cluster, evidence_meta, stock_rank)
    base["finalScore"] = final_score["finalScore"]
    base["finalScoreBreakdown"] = final_score
    base = apply_quality_gates(base, cluster, final_score, candidate)
    if historical_validation.get("actionAdjustment") == "watchlist" and base.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven", "Crypto"}:
        base["action"] = "Watchlist"
        base["qualityGateFailures"] = sorted(set(base.get("qualityGateFailures", []) + ["weak_historical_validation"]))
    metadata = model_metadata(
        [
            "InvestorProfileClusteringAgent",
            "FactorAnalysisAgent",
            "CandidateSelectionAgent",
            "MacroEventInterpreterAgent",
            "GeopoliticalRiskAgent",
            "SectorRotationAgent",
            "FundamentalAnalysisAgent",
            "TechnicalAnalysisAgent",
            "SentimentAnalysisAgent",
            "AlphaDiscoveryAgent",
            "CryptoNarrativeAgent",
            "EvidenceScoringAgent",
            "DynamicStockRankingAgent",
            "StrategyReliabilityAgent",
            "TacticalValidationAgent",
            "PortfolioOptimizationAgent",
            "DynamicAllocationAgent",
            "RecommendationReRankingAgent",
            "ReasoningChainAgent",
            "ContradictionAnalysisAgent",
            "UncertaintyAnalysisAgent",
            "RecommendationInvalidationAgent",
            "ExplainabilityAgent",
            "MasterOrchestratorAgent",
            "RecommendationConsolidationAgent",
            "ConflictResolutionAgent",
            "RecommendationQualityAuditAgent",
            "IntelligenceCompressionAgent",
        ],
        base["dataTimestamp"],
    )
    base["modelMetadata"] = metadata
    base["modelVersion"] = metadata["modelVersion"]
    base["pipelineVersion"] = metadata["pipelineVersion"]
    base["scoringVersion"] = metadata["scoringVersion"]
    base["expectedReturnConfidence"] = "high" if base["evidenceScore"] >= 75 else "medium" if base["evidenceScore"] >= 55 else "low"
    base["candidate"] = candidate or {}
    base["assetIntelligence"] = asset_intelligence
    base["assetIntelligenceBacked"] = bool(asset_intelligence)
    base["investorCluster"] = cluster
    base["factorScores"] = factors
    base["sentimentSignal"] = sentiment
    base["dynamicStockRank"] = stock_rank or {}
    base["relatedRecommendations"] = related_recommendation_candidates(base["instrumentName"], graph)
    base["knowledgeGraphNotes"] = relationship_explanation(base["instrumentName"], graph)
    base["performance"] = initialize_recommendation_performance(base)
    base["institutionalRationale"] = (
        f"This recommendation is linked to priority {goal['priority']} goal '{goal['name']}', "
        f"uses the {regime['regime']} market regime, and is sized inside a {portfolio_plan['riskBudget']} portfolio budget."
    )
    base["fullResearchNotes"] = _full_research_notes(base, fundamental, technical, contrarian, sector_rotation, geopolitical, macro_event, crypto_narrative)
    if fund_choice:
        base["isFundPick"] = True
        base["fundFactors"] = fund_choice["factors"]
        base["factorInsights"] = fund_choice["insights"]
        base["factorDrivers"] = fund_choice["drivers"]
        base["factorScore"] = fund_choice["score"]
        base["diversification"] = fund_choice["diversification"]
        # Re-anchor the market reasoning on the fund actually chosen for this
        # profile (the research-time summary may name a different default fund).
        base["currentMarketReasoning"] = _fund_market_reasoning(fund_choice)
    base.update(_final_schema_aliases(base))
    base = enrich_recommendation_explainability(None, base, llm_enhance=False)
    return base


def _validation_asset(asset, base: dict) -> dict:
    return {
        "assetName": asset.instrument_name,
        "name": asset.instrument_name,
        "instrumentName": asset.instrument_name,
        "ticker": _ticker_for_validation(asset.instrument_name, base.get("ticker", "")),
        "assetType": asset.asset_type,
        "assetClass": asset.asset_key,
        "category": asset.category,
    }


def _ticker_for_validation(name: str, fallback: str = "") -> str:
    return ticker_from_constituents(name) or crypto_ticker_for_name(name) or fallback


def _asset_intelligence_snapshot(db: Session, asset) -> dict:
    name = asset.instrument_name
    technical = db.query(TechnicalIndicator).filter(TechnicalIndicator.asset_name == name).order_by(TechnicalIndicator.id.desc()).first()
    fundamental = db.query(FundamentalMetric).filter(FundamentalMetric.asset_name == name).order_by(FundamentalMetric.id.desc()).first()
    liquidity = db.query(AssetLiquidityScore).filter(AssetLiquidityScore.asset_name == name).order_by(AssetLiquidityScore.id.desc()).first()
    risk = db.query(AssetRiskScore).filter(AssetRiskScore.asset_name == name).order_by(AssetRiskScore.id.desc()).first()
    alpha = db.query(AlphaOpportunity).filter(AlphaOpportunity.asset_name == name).order_by(AlphaOpportunity.id.desc()).first()
    crypto = db.query(CryptoAssetResearch).filter(CryptoAssetResearch.asset_name == name).order_by(CryptoAssetResearch.id.desc()).first()
    snapshot = {
        "technical": _technical_snapshot(technical),
        "fundamental": _fundamental_snapshot(fundamental),
        "liquidity": _liquidity_snapshot(liquidity),
        "risk": _risk_snapshot(risk),
        "alpha": _alpha_snapshot(alpha),
        "crypto": _crypto_snapshot(crypto),
    }
    return {key: value for key, value in snapshot.items() if value}


def _overlay_fundamental(fundamental: dict, asset_intelligence: dict) -> dict:
    stored = asset_intelligence.get("fundamental", {})
    if not stored:
        return fundamental
    merged = dict(fundamental)
    merged.update(
        {
            "fundamentalScore": max(fundamental.get("fundamentalScore", 0), stored.get("fundamentalScore", 0)),
            "summary": stored.get("summary") or fundamental.get("summary", ""),
            "dataCompleteness": stored.get("dataCompleteness") or fundamental.get("dataCompleteness", "low"),
            "dataMode": stored.get("dataMode") or fundamental.get("dataMode", "limited"),
            "sectorTailwindScore": stored.get("sectorTailwindScore", fundamental.get("sectorTailwindScore", 50)),
            "recentNewsSentiment": stored.get("recentNewsSentiment", fundamental.get("recentNewsSentiment", "neutral")),
        }
    )
    return merged


def _overlay_technical(technical: dict, asset_intelligence: dict) -> dict:
    stored = asset_intelligence.get("technical", {})
    if not stored:
        return technical
    merged = dict(technical)
    trend = stored.get("trendStrength", 0)
    merged.update(
        {
            "technicalScore": max(technical.get("technicalScore", 0), trend),
            "priceTrend": "Improving" if trend >= 65 else "Weak" if trend <= 42 else technical.get("priceTrend", "Mixed"),
            "buyZone": stored.get("buyRange") or technical.get("buyZone", ""),
            "supportZone": stored.get("supportZone") or technical.get("supportZone", ""),
            "resistanceZone": stored.get("resistanceZone") or technical.get("resistanceZone", ""),
            "stopLossReference": stored.get("stopLossReference") or technical.get("stopLossReference", ""),
            "reviewZone": stored.get("reviewZone") or technical.get("reviewZone", ""),
            "breakoutStatus": stored.get("breakoutStatus", ""),
            "dataMode": stored.get("dataMode") or technical.get("dataMode", "limited"),
        }
    )
    return merged


def _overlay_crypto_narrative(crypto_narrative: dict, asset_intelligence: dict) -> dict:
    stored = asset_intelligence.get("crypto", {})
    if not stored:
        return crypto_narrative
    merged = dict(crypto_narrative)
    merged.update(
        {
            "narrative": stored.get("narrative") or crypto_narrative.get("narrative", ""),
            "evidenceScore": max(stored.get("evidenceScore", 0), crypto_narrative.get("evidenceScore", 0)),
            "allocationCap": min(stored.get("allocationCap", crypto_narrative.get("allocationCap", 0)), crypto_narrative.get("allocationCap", stored.get("allocationCap", 0)) or stored.get("allocationCap", 0)),
            "actionBias": stored.get("recommendedAction", crypto_narrative.get("actionBias", "Watchlist")).title(),
            "warning": stored.get("riskWarning") or crypto_narrative.get("warning", ""),
        }
    )
    return merged


def _apply_asset_intelligence_boosts(base: dict, asset_intelligence: dict) -> None:
    if not asset_intelligence:
        return
    technical = asset_intelligence.get("technical", {})
    fundamental = asset_intelligence.get("fundamental", {})
    liquidity = asset_intelligence.get("liquidity", {})
    alpha = asset_intelligence.get("alpha", {})
    crypto = asset_intelligence.get("crypto", {})
    evidence_candidates = [
        base.get("evidenceScore", 0),
        technical.get("confidenceScore", 0),
        fundamental.get("fundamentalScore", 0),
        alpha.get("evidenceScore", 0),
        crypto.get("evidenceScore", 0),
    ]
    base["evidenceScore"] = max(value for value in evidence_candidates if isinstance(value, (int, float)))
    base["technicalScore"] = max(base.get("technicalScore", 0), technical.get("trendStrength", 0), technical.get("confidenceScore", 0))
    base["fundamentalScore"] = max(base.get("fundamentalScore", 0), fundamental.get("fundamentalScore", 0))
    if alpha:
        base["noveltyScore"] = max(base.get("noveltyScore", 0), alpha.get("noveltyScore", 0))
        base["asymmetryScore"] = max(base.get("asymmetryScore", 0), alpha.get("asymmetryScore", 0))
        base["riskAdjustedScore"] = max(base.get("riskAdjustedScore", 0), alpha.get("riskAdjustedScore", 0))
        base["recommendationType"] = "Underdog" if alpha.get("bucket") in {"underdog", "contrarian"} else "Tactical"
        base["invalidationTrigger"] = alpha.get("invalidationTrigger") or base.get("invalidationTrigger", "")
    if liquidity and not liquidity.get("minimumLiquidityPassed", True):
        base["action"] = "Watchlist"
        base["qualityGateFailures"] = sorted(set(base.get("qualityGateFailures", []) + ["asset_intelligence_liquidity"]))
    if crypto:
        base["evidenceScore"] = max(base["evidenceScore"], crypto.get("evidenceScore", 0))


def _apply_asset_intelligence_action_gates(base: dict, asset_intelligence: dict) -> None:
    if not asset_intelligence:
        return
    liquidity = asset_intelligence.get("liquidity", {})
    alpha = asset_intelligence.get("alpha", {})
    crypto = asset_intelligence.get("crypto", {})
    if liquidity and not liquidity.get("minimumLiquidityPassed", True):
        base["action"] = "Watchlist"
        base["qualityGateFailures"] = sorted(set(base.get("qualityGateFailures", []) + ["asset_intelligence_liquidity"]))
    if alpha and alpha.get("suggestedAction") == "watchlist":
        base["action"] = "Watchlist"
    if crypto and crypto.get("recommendedAction") == "watchlist":
        base["action"] = "Watchlist"


def _technical_snapshot(row: TechnicalIndicator | None) -> dict:
    if row is None:
        return {}
    return {
        "latestPrice": row.latest_price,
        "trendStrength": row.trend_strength,
        "confidenceScore": row.confidence_score,
        "supportZone": row.support_zone,
        "resistanceZone": row.resistance_zone,
        "breakoutStatus": row.breakout_status,
        "buyRange": row.buy_range,
        "reviewZone": row.review_zone,
        "stopLossReference": row.stop_loss_reference,
        "dataMode": row.data_mode,
        "sourceUrl": row.source_url,
        "retrievedAt": row.retrieved_at,
    }


def _fundamental_snapshot(row: FundamentalMetric | None) -> dict:
    if row is None:
        return {}
    return {
        "fundamentalScore": row.fundamental_score,
        "summary": "; ".join(filter(None, [row.revenue_growth_trend, row.profit_growth_trend, row.earnings_momentum])),
        "dataCompleteness": row.data_completeness,
        "sectorTailwindScore": row.sector_tailwind_score,
        "recentNewsSentiment": row.recent_news_sentiment,
        "dataMode": row.data_mode,
        "retrievedAt": row.retrieved_at,
    }


def _liquidity_snapshot(row: AssetLiquidityScore | None) -> dict:
    if row is None:
        return {}
    return {
        "liquidityScore": row.liquidity_score,
        "volumeScore": row.volume_score,
        "marketCapTier": row.market_cap_tier,
        "minimumLiquidityPassed": row.minimum_liquidity_passed == "yes",
        "liquidityNotes": row.liquidity_notes,
        "retrievedAt": row.retrieved_at,
    }


def _risk_snapshot(row: AssetRiskScore | None) -> dict:
    if row is None:
        return {}
    return {
        "riskCategory": row.risk_category,
        "volatilityScore": row.volatility_score,
        "drawdownScore": row.drawdown_score,
        "riskNotes": row.risk_notes,
        "retrievedAt": row.retrieved_at,
    }


def _alpha_snapshot(row: AlphaOpportunity | None) -> dict:
    if row is None:
        return {}
    return {
        "bucket": row.bucket,
        "nonObviousReason": row.non_obvious_reason,
        "keySignal": row.key_signal,
        "asymmetryScore": row.asymmetry_score,
        "noveltyScore": row.novelty_score,
        "evidenceScore": row.evidence_score,
        "riskAdjustedScore": row.risk_adjusted_score,
        "suggestedAction": row.suggested_action,
        "allocationCap": row.allocation_cap,
        "invalidationTrigger": row.invalidation_trigger,
        "riskLabel": row.risk_label,
        "retrievedAt": row.retrieved_at,
    }


def _crypto_snapshot(row: CryptoAssetResearch | None) -> dict:
    if row is None:
        return {}
    return {
        "narrative": row.narrative,
        "liquidityScore": row.liquidity_score,
        "volatilityScore": row.volatility_score,
        "evidenceScore": row.evidence_score,
        "recommendedAction": row.recommended_action,
        "allocationCap": row.allocation_cap,
        "riskWarning": row.risk_warning,
        "retrievedAt": row.retrieved_at,
    }


def _apply_validation_adjustment(base: dict, validation: dict) -> None:
    adjustment = validation.get("convictionAdjustment", 0)
    base["convictionScore"] = max(5, min(95, round(base.get("convictionScore", 50) + adjustment)))
    base["riskAdjustedScore"] = max(5, min(95, round(base.get("riskAdjustedScore", 50) + adjustment)))
    if validation.get("downgradeReason") and base.get("recommendationType") in {"Tactical", "Underdog", "Event-driven", "Speculative", "Watchlist"}:
        multiplier = validation.get("allocationMultiplier", 0.5)
        base["suggestedMonthlyAmount"] = round(base.get("suggestedMonthlyAmount", 0) * multiplier)
        base["suggestedAllocationPercentage"] = max(0, round(base.get("suggestedAllocationPercentage", 0) * multiplier))


def _portfolio_optimization_fields(asset_key: str, base: dict, optimization: dict) -> dict:
    bucket_key = _portfolio_bucket_for_asset(asset_key, base)
    bucket = next((item for item in optimization.get("bucketAllocations", []) if item.get("bucketKey") == bucket_key), {})
    gap = bucket.get("gapPercentage", 0)
    concentration_risk = "increases" if gap < -3 else "neutral" if gap <= 3 else "reduces drift"
    return {
        "portfolioBucket": bucket.get("bucketName", bucket_key),
        "portfolioBucketKey": bucket_key,
        "allocationImpact": (
            f"Adds to {bucket.get('bucketName', bucket_key)}. Current {bucket.get('currentPercentage', 0)}%, "
            f"target {bucket.get('targetPercentage', 0)}%, gap {gap}%."
        ),
        "helpsDiversification": gap > 0,
        "concentrationRiskImpact": concentration_risk,
        "portfolioOptimizationSummary": optimization.get("summary", {}),
    }


def _portfolio_bucket_for_asset(asset_key: str, base: dict) -> str:
    recommendation_type = base.get("recommendationType", "")
    if asset_key == "debt":
        return "goal_specific_investments"
    if asset_key == "gold":
        return "defensive_hedge"
    if asset_key == "crypto":
        return "crypto_high_risk"
    if asset_key == "tactical" or recommendation_type in {"Tactical", "Underdog", "Event-driven", "Watchlist"}:
        return "tactical_opportunities"
    return "core_long_term_wealth"


def _recommendation_type(asset_key: str, asset_type: str, instrument_name: str, reasoning: str, category: str = "") -> str:
    text = f"{asset_type} {instrument_name} {category} {reasoning}".lower()
    if "watchlist" in text:
        return "Watchlist"
    if "asset intelligence" in text:
        return "Tactical"
    if "underdog" in text or "emerging" in text:
        return "Underdog"
    if "event-driven" in text or "defence" in text or "infrastructure" in text or "capex" in text:
        return "Event-driven"
    if asset_key == "tactical":
        return "Tactical"
    if asset_key == "crypto":
        return "Speculative"
    if asset_key == "gold":
        return "Defensive"
    if asset_key == "debt":
        return "Defensive"
    return "Core"


def _asset_count_caps(cluster: dict) -> dict[str, int]:
    # Per-class ceilings (not a fixed order — final ranking is class-agnostic).
    # Fixed-income variety (gilt/corporate/banking-PSU/arbitrage/liquid) is now
    # available, so debt caps allow a couple of options for those who need safety.
    risk = cluster.get("riskProfile", "moderate")
    if risk == "conservative":
        return {"debt": 4, "equity": 5, "gold": 2, "crypto": 0, "tactical": 1, "other": 2}
    if risk == "very_aggressive":
        return {"debt": 2, "equity": 11, "gold": 2, "crypto": 4, "tactical": 4, "other": 1}
    if risk == "aggressive":
        return {"debt": 2, "equity": 10, "gold": 2, "crypto": 3, "tactical": 3, "other": 1}
    return {"debt": 3, "equity": 8, "gold": 2, "crypto": 2, "tactical": 2, "other": 2}


def _opportunity_scores(
    base: dict,
    fit: dict,
    conviction: dict,
    supporting_count: int,
    conflicting_count: int,
    fundamental: dict,
    technical: dict,
    contrarian: dict,
    macro_event: dict | None,
    sector_score: int,
) -> dict:
    evidence = min(95, base["confidenceScore"] + supporting_count * 4 - conflicting_count * 5)
    asymmetry = 50 + (technical.get("technicalScore", 50) - 50) // 2 + (contrarian.get("contrarianScore", 30) - 35) // 4
    if macro_event:
        asymmetry += 8
    if base["riskLevel"] == "High":
        asymmetry -= 6
    novelty = 25
    if base["recommendationType"] in {"Underdog", "Event-driven", "Watchlist"}:
        novelty += 35
    elif base["recommendationType"] in {"Tactical", "Speculative"}:
        novelty += 22
    if contrarian.get("isContrarian"):
        novelty += 14
    risk_penalty = {"Low": 6, "Medium": 16, "High": 30}.get(base["riskLevel"], 16)
    risk_adjusted = (
        base["suitabilityScore"] * 0.28
        + conviction["convictionScore"] * 0.24
        + evidence * 0.18
        + max(10, min(95, asymmetry)) * 0.16
        + fundamental.get("fundamentalScore", 50) * 0.08
        + max(-20, min(20, sector_score)) * 0.25
        - risk_penalty
    )
    return {
        "evidenceScore": max(10, min(95, round(evidence))),
        "asymmetryScore": max(10, min(95, round(asymmetry))),
        "noveltyScore": max(5, min(95, round(novelty))),
        "riskAdjustedScore": max(5, min(95, round(risk_adjusted))),
        "fundamentalScore": fundamental.get("fundamentalScore", 0),
        "technicalScore": technical.get("technicalScore", 0),
    }


def _action_for(base: dict, crypto_narrative: dict) -> str:
    if base["recommendationType"] == "Watchlist" or crypto_narrative.get("actionBias") == "Watchlist":
        return "Watchlist"
    if base["riskLevel"] == "High" and base.get("evidenceScore", 0) < 60:
        return "Watchlist"
    if base["recommendationType"] == "Defensive":
        return "Accumulate"
    if base["recommendationType"] in {"Tactical", "Underdog", "Event-driven", "Speculative"}:
        return "Accumulate gradually"
    return "Buy gradually"


def _strategy_bucket(base: dict, asset_key: str, contrarian: dict, macro_event: dict | None, crypto_narrative: dict) -> str:
    if asset_key == "crypto":
        return "Crypto"
    if base["recommendationType"] == "Defensive":
        return "Defensive"
    if base["recommendationType"] == "Core":
        return "Core"
    if base["recommendationType"] == "Underdog":
        return "Underdog"
    if base["recommendationType"] == "Event-driven" or macro_event:
        return "Event-driven"
    if base["recommendationType"] == "Tactical" or contrarian.get("isContrarian"):
        return "Tactical"
    if base["recommendationType"] == "Defensive":
        return "Defensive"
    return "Core"


def _key_trigger(base: dict, macro_event: dict | None, technical: dict, sector_rotation: dict) -> str:
    if macro_event:
        return _shorten(macro_event["headline"], 110)
    if base["recommendationType"] in {"Tactical", "Underdog", "Event-driven"}:
        return _shorten(f"{technical.get('priceTrend', 'Mixed')} technical setup; {sector_rotation.get('summary', '')}", 110)
    if base["recommendationType"] == "Defensive":
        return "Protect near-term goals and emergency liquidity before taking more risk."
    return "Long goal horizon supports gradual accumulation instead of one-time timing."


def _why_this_matters(base: dict, macro_event: dict | None, contrarian: dict, crypto_narrative: dict) -> str:
    if crypto_narrative:
        return f"{crypto_narrative.get('narrative')}; keep this amount small because losses can be severe."
    if macro_event:
        return f"{macro_event['headline']}; this idea connects the update to your goal timeline and comfort with risk."
    if contrarian.get("isContrarian"):
        return "This is a less-obvious idea that may be worth watching while markets remain cautious, but the amount must stay small."
    return base.get("userSpecificReasoning", "")


def _thesis_bullets(base: dict, macro_event: dict | None, fundamental: dict, technical: dict, contrarian: dict, crypto_narrative: dict) -> list[str]:
    bullets = [
        base.get("whyThisMatters") or base.get("userSpecificReasoning", ""),
        base.get("whyNow") or base.get("marketRegimeSummary", ""),
        f"Supporting signals: {base.get('evidenceScore', base.get('confidenceScore'))}% and confidence level {base.get('convictionScore')}%.",
    ]
    if macro_event:
        bullets.append(f"Less-obvious connection: {macro_event['headline']}.")
    elif contrarian.get("isContrarian"):
        bullets.append(contrarian["summary"])
    elif crypto_narrative:
        bullets.append(f"Supporting story: {crypto_narrative.get('narrative')}.")
    else:
        bullets.append(f"Investment-quality and price-trend note: {fundamental.get('summary')} {technical.get('priceTrend')} trend.")
    bullets.append(base.get("whatCanGoWrong", "This idea can weaken if its supporting information changes."))
    return [_shorten(item, 180) for item in bullets if item][:5]


def _risk_bullets(base: dict, crypto_narrative: dict) -> list[str]:
    bullets = [
        base.get("downsideScenario") or base.get("whatCanGoWrong", ""),
        base.get("volatilityWarning", ""),
        "Check that this can be bought and sold easily, including the price gap between buyers and sellers, before acting.",
        base.get("concentrationImpact", ""),
    ]
    if crypto_narrative:
        bullets[2] = crypto_narrative.get("warning", bullets[2])
    return [_shorten(item, 160) for item in bullets if item][:4]


def _evidence_points(base: dict, evidence_items: list[dict]) -> list[dict]:
    if evidence_items:
        ranked_items = sorted(evidence_items, key=lambda item: (item.get("confidenceContribution", 0), item.get("credibilityScore", 0)), reverse=True)
        return [
            {
                "source": item.get("sourceName", "Research source"),
                "sourceName": item.get("sourceName", "Research source"),
                "sourceUrl": item.get("sourceUrl", ""),
                "timestamp": item.get("timestamp", base.get("dataTimestamp", "")),
                "signalType": item.get("signalType", "market signal"),
                "confidence": item.get("confidenceContribution", 0),
                "summary": item.get("summary", ""),
                "credibilityScore": item.get("credibilityScore", 0),
                "relevanceScore": item.get("relevanceScore", 0),
                "recencyScore": item.get("recencyScore", 0),
                "confidenceContribution": item.get("confidenceContribution", 0),
            }
            for item in ranked_items[:5]
        ]
    signals = [*base.get("supportingSignals", []), *base.get("contradictorySignals", [])]
    ranked = sorted(signals, key=lambda item: (item.get("confidenceScore", 0), item.get("credibilityScore", 0)), reverse=True)
    return [
        {
            "source": signal.get("sourceName", "Research source"),
            "timestamp": signal.get("retrievedAt", base.get("dataTimestamp", "")),
            "signalType": signal.get("signalType", "market signal"),
            "confidence": signal.get("confidenceScore", 0),
            "summary": _shorten(signal.get("summary", signal.get("title", "")), 140),
        }
        for signal in ranked[:5]
    ]


def _strict_allocation_cap(asset_key: str, recommendation_type: str, crypto_narrative: dict, suggested: int) -> int:
    if asset_key == "crypto":
        return min(suggested, crypto_narrative.get("allocationCap", 3))
    if recommendation_type in {"Underdog", "Watchlist"}:
        return min(suggested, 3)
    if recommendation_type in {"Tactical", "Event-driven"}:
        return min(suggested, 6)
    return suggested


def _invalidation_trigger(asset_key: str, technical: dict, macro_event: dict | None) -> str:
    if asset_key in {"equity", "tactical", "crypto"}:
        return technical.get("stopLossReference", "Review this if the price trend breaks or supporting information weakens.")
    if macro_event:
        return f"Review this if the wider-market connection weakens: {macro_event['headline']}."
    return "Review this if fund quality, access to your money, or your linked goal timeline changes."


def _full_research_notes(base: dict, fundamental: dict, technical: dict, contrarian: dict, sector_rotation: dict, geopolitical: dict, macro_event: dict | None, crypto_narrative: dict) -> list[str]:
    notes = [
        f"Investment quality: {fundamental.get('summary')}",
        f"Price trend: {technical.get('priceTrend')} trend; area to watch: {technical.get('supportZone')}",
        f"Sector movement: {sector_rotation.get('summary')}",
        f"Global-events risk: {geopolitical.get('riskLevel')} ({', '.join(geopolitical.get('drivers', [])[:3])})",
        f"Less-obvious angle: {contrarian.get('summary')}",
    ]
    if macro_event:
        notes.append(f"Wider-market or event connection: {macro_event['headline']} Who may benefit: {', '.join(macro_event['beneficiaries'])}.")
    if crypto_narrative:
        notes.append(f"Digital-asset story: {crypto_narrative.get('narrative')}. {crypto_narrative.get('warning')}")
    notes.append(base.get("institutionalRationale", ""))
    notes.extend(base.get("knowledgeGraphNotes", []))
    return [note for note in notes if note]


def _final_schema_aliases(base: dict) -> dict:
    expected = base.get("expectedReturn", {})
    action = _normalize_action(base.get("action", "watchlist"))
    bucket = _normalize_bucket(base.get("strategyBucket", "Core"))
    strategy_type = _normalize_strategy(base.get("recommendationType", "Core"))
    linked_goals = [
        {
            "goalName": goal.get("name", ""),
            "priority": goal.get("priority", 0),
            "timeline": f"{goal.get('timeHorizonMonths', 0)} months",
            "fundingGapRelevance": f"Funding gap {goal.get('fundingGap', 0)} is considered in sizing.",
        }
        for goal in base.get("linkedGoals", [])
    ]
    return {
        "assetName": base.get("instrumentName", ""),
        "assetClass": base.get("assetType", ""),
        "bucket": bucket,
        "strategyType": strategy_type,
        "suggestedAmount": base.get("suggestedMonthlyAmount", 0),
        "allocationPercent": base.get("suggestedAllocationPercentage", 0),
        "allocationCap": base.get("strictAllocationCap", 0),
        "expectedReturnRange": expected.get("label", ""),
        "expectedCagr": f"{expected.get('expectedCagr')}%" if expected.get("expectedCagr") is not None else "",
        "rebalanceTrigger": base.get("rebalanceLogic", ""),
        "exitTrigger": base.get("invalidationTrigger", ""),
        "stopLossReference": base.get("stopLossLogic", ""),
        "linkedGoalDetails": linked_goals,
        "scores": {
            "suitability": base.get("suitabilityScore", 0),
            "conviction": base.get("convictionScore", 0),
            "evidence": base.get("evidenceScore", 0),
            "asymmetry": base.get("asymmetryScore", 0),
            "novelty": base.get("noveltyScore", 0),
            "riskAdjusted": base.get("riskAdjustedScore", 0),
            "marketRegimeFit": base.get("finalScoreBreakdown", {}).get("marketRegimeFitScore", 0),
            "technicalTiming": base.get("technicalScore", 0),
            "fundamentalQuality": base.get("fundamentalScore", 0),
            "historicalReliability": base.get("validationScore", 0),
        },
        "summary": {
            "whyThisMatters": base.get("whyThisMatters", ""),
            "keyTrigger": base.get("keyTrigger", ""),
            "whyNow": base.get("whyNow", ""),
            "nonObviousInsight": base.get("thesisBullets", [""])[3] if len(base.get("thesisBullets", [])) > 3 else "",
            "allocationImpact": base.get("allocationImpact", ""),
        },
        "thesis": base.get("thesisBullets", []),
        "supportingSignalSummaries": [item.get("summary", "") for item in base.get("supportingSignals", [])],
        "conflictingSignalSummaries": [item.get("summary", "") for item in base.get("contradictorySignals", [])],
        "risks": {
            "riskLevel": base.get("riskLevel", "Medium").lower(),
            "downsideRisk": base.get("downsideScenario", ""),
            "volatilityRisk": base.get("volatilityWarning", ""),
            "liquidityRisk": "Verify live liquidity, bid-ask spread, and exit rules before acting.",
            "concentrationRisk": base.get("concentrationImpact", ""),
            "whatCanGoWrong": base.get("riskBullets", []),
            "invalidationTrigger": base.get("invalidationTrigger", ""),
        },
        "evidence": base.get("evidencePoints", []),
        "lastResearchedAt": base.get("dataTimestamp", ""),
        "action": action,
        "validation": base.get("historicalValidation", {}),
        "portfolioBucket": base.get("portfolioBucket", ""),
        "portfolioBucketKey": base.get("portfolioBucketKey", ""),
        "allocationImpact": base.get("allocationImpact", ""),
        "helpsDiversification": base.get("helpsDiversification", False),
        "concentrationRiskImpact": base.get("concentrationRiskImpact", ""),
    }


def _normalize_action(action: str) -> str:
    value = action.lower()
    if "avoid" in value:
        return "avoid"
    if "watch" in value:
        return "watchlist"
    if "hold" in value:
        return "hold"
    if "accumulate" in value:
        return "accumulate"
    return "buy"


def _normalize_bucket(bucket: str) -> str:
    mapping = {
        "Core": "core",
        "Tactical": "tactical",
        "Underdog": "underdog",
        "Event-driven": "event_driven",
        "Defensive": "defensive",
        "Crypto": "crypto",
        "Watchlist": "watchlist",
    }
    return mapping.get(bucket, "core")


def _normalize_strategy(strategy: str) -> str:
    mapping = {"Core": "core", "Strategic": "strategic", "Tactical": "tactical", "Speculative": "speculative", "Defensive": "defensive"}
    return mapping.get(strategy, "strategic")


def _expected_return(asset_key: str, asset_type: str, recommendation_type: str, regime: dict, tactical: dict) -> dict:
    estimates = {
        "debt": (5.5, 6.8, 7.8),
        "equity": (8.0, 12.0, 15.0),
        "gold": (5.0, 7.0, 9.0),
        "crypto": (-8.0, 12.0, 28.0),
        "tactical": (6.0, 11.0, 18.0),
        "other": (5.0, 8.0, 11.0),
    }
    conservative, base, aggressive = estimates.get(asset_key, estimates["other"])
    asset_label = f"{recommendation_type.lower()} {asset_type.lower()}".strip()

    if "Midcap" in asset_type or "Sector" in asset_type:
        conservative += 1.0
        base += 1.5
        aggressive += 2.5
    if "ETF" in asset_type and asset_key == "equity":
        conservative -= 0.5
        base -= 0.5
    if asset_key == "tactical":
        base += min(2.0, tactical.get("tacticalScore", 50) / 50)
        aggressive += min(3.0, tactical.get("tacticalScore", 50) / 35)

    regime_name = regime.get("regime", "limited-data")
    if regime_name == "risk-on":
        conservative += 0.5
        base += 1.0
        aggressive += 1.5
    elif regime_name == "risk-off":
        conservative -= 1.5
        base -= 1.0
        aggressive -= 0.5
    elif regime_name == "limited-data":
        conservative -= 0.5
        base -= 0.5

    conservative = round(conservative, 1)
    base = round(base, 1)
    aggressive = round(max(base + 0.5, aggressive), 1)
    inflation_assumption = 6.0
    inflation_adjusted = round(base - inflation_assumption, 1)

    return {
        "label": f"{conservative:g}-{aggressive:g}% CAGR",
        "cagrRange": f"{conservative:g}-{aggressive:g}%",
        "expectedCagr": base,
        "conservative": conservative,
        "base": base,
        "aggressive": aggressive,
        "inflationAdjustedBase": inflation_adjusted,
        "inflationAssumption": inflation_assumption,
        "assumptions": (
            f"Estimated from {asset_label or asset_key} return assumptions, current {regime_name} market conditions, "
            "your comfort with ups and downs, and short-term opportunity checks where relevant."
        ),
        "disclaimer": "Expected return is an assumption range, not a promise of future results.",
    }


def _ticker_for(name: str) -> str:
    return ticker_from_constituents(name).replace(".NS", "") or crypto_ticker_for_name(name)


def _concentration_impact(asset_key: str, allocation: int) -> str:
    if asset_key in {"equity", "tactical", "crypto"}:
        return f"Keep this near the suggested {allocation}% share so one risky idea does not dominate your priority goals."
    if asset_key == "gold":
        return "Gold should help spread risk, not become your main growth investment."
    return "This adds stability, but do not add more than your linked goal needs."


def _volatility_warning(asset_key: str) -> str:
    warnings = {
        "equity": "Shares can fall sharply when markets decline. Invest gradually and avoid selling because of short-term fear.",
        "tactical": "Short-term ideas can reverse quickly. Decide when to review and how much loss you can accept before investing.",
        "crypto": "Digital assets can move sharply and should remain a very small optional investment.",
        "gold": "Gold may perform poorly for long periods even when it helps spread risk.",
        "debt": "Debt funds can still be affected by interest rates, fund quality, taxes, and access to your money.",
    }
    return warnings.get(asset_key, "Review possible price swings and access to your money before acting.")


def _portfolio_role(asset_key: str, goal: dict) -> str:
    if asset_key == "debt":
        return "Keeps money steadier and easier to access for essential or near-term goals."
    if asset_key == "equity":
        return "Supports long-term growth for goals with enough time to handle market ups and downs."
    if asset_key == "gold":
        return "Adds stability when wider markets or the rupee feel uncertain."
    if asset_key == "crypto":
        return "A small optional higher-risk investment for non-essential goals only."
    if asset_key == "tactical":
        return "A small short-term idea that needs a clear limit and regular review."
    return f"A small optional investment linked to {goal['name']}."


def _asset_response(asset) -> dict:
    return {
        "instrumentName": asset.instrument_name,
        "assetType": asset.asset_type,
        "category": asset.category,
        "summary": asset.summary,
        "suitabilityNotes": asset.suitability_notes,
        "riskNotes": asset.risk_notes,
        "evidence": asset.evidence,
        "dataMode": asset.data_mode,
        "confidenceScore": asset.confidence_score,
        "retrievedAt": asset.retrieved_at,
    }


def _compact_signal(signal: dict) -> dict:
    item = dict(signal)
    item["summary"] = _shorten(item.get("summary", ""), 420)
    item["title"] = _shorten(item.get("title", item["summary"]), 90)
    return item


def _shorten(value: str, limit: int) -> str:
    value = " ".join((value or "").split())
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "..."


def _review_date_from_cadence(cadence: str) -> str:
    if "weekly" in cadence.lower():
        days = 7
    elif "30" in cadence:
        days = 30
    elif "45" in cadence:
        days = 45
    elif "6 months" in cadence.lower():
        days = 180
    else:
        days = 90
    return (datetime.now(UTC).date() + timedelta(days=days)).isoformat()
