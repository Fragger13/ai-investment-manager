from __future__ import annotations

import json
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.agents.alpha_discovery_agent import discover_alpha_opportunities
from app.agents.crypto_intelligence_agent import analyze_crypto_asset
from app.agents.fundamental_analysis_agent import analyze_fundamental_metrics
from app.agents.liquidity_risk_agent import assess_liquidity_and_risk
from app.agents.sector_asset_mapper_agent import base_asset_universe, map_signals_to_assets
from app.agents.technical_analysis_agent import calculate_technical_indicators
from app.models.alpha_opportunity import AlphaOpportunity
from app.models.asset_liquidity_score import AssetLiquidityScore
from app.models.asset_research import AssetResearch
from app.models.asset_risk_score import AssetRiskScore
from app.models.crypto_asset_research import CryptoAssetResearch
from app.models.fundamental_metric import FundamentalMetric
from app.models.technical_indicator import TechnicalIndicator
from app.services.assets.asset_insight_validation_service import (
    complete_sentence_summary,
    validate_alpha_insight,
    validate_asset_insight,
    validate_crypto_insight,
)
from app.services.intelligence import now_iso
from app.services.market.signal_intelligence_service import impact_map_list, latest_market_regime, market_signal_list
from app.services.research.http_client import fetch_text
from app.services.research.source_cache_service import save_assets


def refresh_asset_intelligence(db: Session, risk_profile: str = "moderate") -> dict:
    signals = market_signal_list(db, limit=120)
    impact_maps = impact_map_list(db, limit=120)
    regime = latest_market_regime(db)
    assets = _dedupe_assets(base_asset_universe() + map_signals_to_assets(signals, impact_maps) + _reddit_underdog_assets())
    sector_scores = _sector_scores_from_impact_maps(impact_maps)

    technical_by_name: dict[str, dict] = {}
    fundamental_by_name: dict[str, dict] = {}
    liquidity_by_name: dict[str, dict] = {}
    crypto_rows: list[dict] = []
    research_assets: list[dict] = []

    for asset in assets:
        history = fetch_price_history(asset)
        technical = calculate_technical_indicators(asset, history)
        crypto = analyze_crypto_asset(asset, signals, risk_profile) if asset.get("assetClass") == "crypto" else None
        fundamental = analyze_fundamental_metrics(asset, signals, sector_scores)
        liquidity = assess_liquidity_and_risk(asset, technical, crypto)

        technical_by_name[asset["name"]] = technical
        fundamental_by_name[asset["name"]] = fundamental
        liquidity_by_name[asset["name"]] = liquidity

        _save_technical(db, asset, technical)
        _save_fundamental(db, asset, fundamental)
        _save_liquidity_and_risk(db, asset, liquidity)
        if crypto:
            _save_crypto(db, crypto)
            crypto_rows.append(crypto)
        research_assets.append(_asset_research_payload(asset, technical, fundamental, liquidity, crypto))

    alpha = discover_alpha_opportunities(assets, signals, technical_by_name, fundamental_by_name, liquidity_by_name, regime)
    for item in alpha:
        _save_alpha(db, item)

    save_assets(db, research_assets)
    return {
        "status": "refreshed",
        "assetsProcessed": len(assets),
        "technicalSignals": len(technical_by_name),
        "fundamentalSignals": len(fundamental_by_name),
        "cryptoOpportunities": len(crypto_rows),
        "alphaOpportunities": len(alpha),
        "dataMode": _combined_mode(research_assets),
        "retrievedAt": now_iso(),
    }


def _reddit_underdog_assets() -> list[dict]:
    """Underdog names trending in curated subreddits that we don't already hold/
    recommend, each **factor-checked** against the live quant engine before being
    fed into the Discover research pipeline. Reddit only nominates; the factor check
    decides whether a name is even researched. Degrades to [] on any error."""
    try:
        from app.services.research.reddit_research_service import discover_underdogs

        nominations = discover_underdogs(set(), limit=4)
    except Exception:  # noqa: BLE001 — community data must never break Discover
        return []

    out: list[dict] = []
    for nom in nominations:
        try:
            factors = None
            if nom["assetClass"] == "equity":
                from app.services.research.equity_factor_service import equity_factors

                factors = equity_factors(nom["ticker"], nom["name"])
                ticker, asset_class, asset_type = nom["ticker"], "equity", "Equity share"
            elif nom["assetClass"] == "crypto":
                from app.services.research.crypto_factor_service import factors_for_symbol

                factors = factors_for_symbol(nom["ticker"], nom["name"])
                ticker, asset_class, asset_type = f"{nom['ticker']}-USD", "crypto", "Crypto asset"
            else:
                continue
            if not factors or factors.get("sortino") is None:
                continue  # could not validate on factors -> do not surface

            subs = ", ".join(f"r/{s}" for s in nom.get("subreddits", [])[:2]) or "community forums"
            evidence = [
                {"sourceName": f"Reddit {subs}", "sourceUrl": sp.get("url", ""), "dataMode": "limited"}
                for sp in nom.get("samplePosts", [])[:2]
                if sp.get("url")
            ]
            out.append(
                {
                    "name": nom["name"],
                    "ticker": ticker,
                    "assetClass": asset_class,
                    "assetType": asset_type,
                    "sectors": [],
                    "reasonForInclusion": (
                        f"Surfaced from community discussion on {subs} ({nom['mentionCount']} recent mentions) "
                        f"and clears our risk-adjusted factor screen (Sortino {factors['sortino']}). "
                        "Community chatter is noisy — research before acting."
                    ),
                    "evidence": evidence,
                }
            )
        except Exception:  # noqa: BLE001
            continue
    return out


def asset_research(db: Session) -> list[dict]:
    rows = db.query(AssetResearch).order_by(AssetResearch.retrieved_at.desc()).limit(120).all()
    if not rows:
        refresh_asset_intelligence(db)
        rows = db.query(AssetResearch).order_by(AssetResearch.retrieved_at.desc()).limit(120).all()
    seen = set()
    output = []
    for row in rows:
        if row.instrument_name in seen:
            continue
        seen.add(row.instrument_name)
        output.append(validate_asset_insight(_research_row(db, row), llm_enhance=False))
    return output


def asset_detail(db: Session, symbol: str) -> dict | None:
    symbol_lower = symbol.lower()
    rows = db.query(AssetResearch).order_by(AssetResearch.retrieved_at.desc()).all()
    for row in rows:
        ticker = _ticker_for_name(row.instrument_name)
        if symbol_lower in {row.instrument_name.lower(), ticker.lower(), ticker.replace(".NS", "").lower()}:
            return validate_asset_insight(_research_row(db, row), llm_enhance=False)
    return None


def alpha_opportunities(db: Session) -> list[dict]:
    rows = db.query(AlphaOpportunity).order_by(AlphaOpportunity.risk_adjusted_score.desc()).limit(40).all()
    if not rows:
        refresh_asset_intelligence(db)
        rows = db.query(AlphaOpportunity).order_by(AlphaOpportunity.risk_adjusted_score.desc()).limit(40).all()
    return [
        validate_alpha_insight({
            "assetName": row.asset_name,
            "ticker": row.ticker,
            "assetType": row.asset_type,
            "bucket": row.bucket,
            "nonObviousReason": row.non_obvious_reason,
            "keySignal": row.key_signal,
            "supportingSignals": _loads(row.supporting_signals_json),
            "conflictingSignals": _loads(row.conflicting_signals_json),
            "asymmetryScore": row.asymmetry_score,
            "noveltyScore": row.novelty_score,
            "evidenceScore": row.evidence_score,
            "riskAdjustedScore": row.risk_adjusted_score,
            "suggestedAction": row.suggested_action,
            "allocationCap": row.allocation_cap,
            "invalidationTrigger": row.invalidation_trigger,
            "riskLabel": row.risk_label,
            "retrievedAt": row.retrieved_at,
        })
        for row in rows
    ]


def crypto_opportunities(db: Session) -> list[dict]:
    rows = db.query(CryptoAssetResearch).order_by(CryptoAssetResearch.evidence_score.desc()).limit(20).all()
    if not rows:
        refresh_asset_intelligence(db)
        rows = db.query(CryptoAssetResearch).order_by(CryptoAssetResearch.evidence_score.desc()).limit(20).all()
    return [
        validate_crypto_insight({
            "assetName": row.asset_name,
            "symbol": row.symbol,
            "narrative": row.narrative,
            "marketCapTier": row.market_cap_tier,
            "liquidityScore": row.liquidity_score,
            "volatilityScore": row.volatility_score,
            "narrativeStrength": row.narrative_strength,
            "evidenceScore": row.evidence_score,
            "recommendedAction": row.recommended_action,
            "allocationCap": row.allocation_cap,
            "riskWarning": row.risk_warning,
            "evidence": _loads(row.evidence_json),
            "dataMode": row.data_mode,
            "retrievedAt": row.retrieved_at,
        })
        for row in rows
    ]


def technical_signals(db: Session) -> list[dict]:
    rows = db.query(TechnicalIndicator).order_by(TechnicalIndicator.retrieved_at.desc()).limit(80).all()
    if not rows:
        refresh_asset_intelligence(db)
        rows = db.query(TechnicalIndicator).order_by(TechnicalIndicator.retrieved_at.desc()).limit(80).all()
    return [_technical_row(row) for row in rows]


def fundamental_signals(db: Session) -> list[dict]:
    rows = db.query(FundamentalMetric).order_by(FundamentalMetric.retrieved_at.desc()).limit(80).all()
    if not rows:
        refresh_asset_intelligence(db)
        rows = db.query(FundamentalMetric).order_by(FundamentalMetric.retrieved_at.desc()).limit(80).all()
    return [_fundamental_row(row) for row in rows]


def fetch_price_history(asset: dict) -> dict:
    ticker = asset.get("ticker", "")
    if not ticker:
        return {"closes": [], "volumes": [], "dataMode": "limited", "sourceUrl": ""}
    yahoo_symbol = _yahoo_symbol(ticker)
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(yahoo_symbol, safe='')}?range=1y&interval=1d"
    result = fetch_text(url, timeout=8, retries=2, cache_ttl_seconds=6 * 3600, require_json=True)
    try:
        payload = json.loads(result.text)
    except (ValueError, json.JSONDecodeError):
        return {"closes": [], "volumes": [], "dataMode": result.mode, "sourceUrl": url}
    chart = (payload.get("chart", {}).get("result") or [{}])[0]
    quote_data = (chart.get("indicators", {}).get("quote") or [{}])[0]
    closes = [value for value in quote_data.get("close", []) if isinstance(value, (int, float))]
    volumes = [value for value in quote_data.get("volume", []) if isinstance(value, (int, float))]
    return {"closes": closes, "volumes": volumes, "dataMode": result.mode, "sourceUrl": url}


def _asset_research_payload(asset: dict, technical: dict, fundamental: dict, liquidity: dict, crypto: dict | None) -> dict:
    action = _action(liquidity, technical, fundamental, crypto)
    evidence = (asset.get("evidence", []) + fundamental.get("evidence", []) + (crypto.get("evidence", []) if crypto else []))[:8]
    data_mode = "live" if technical.get("dataMode") == "live" or any(item.get("dataMode") == "live" for item in evidence) else technical.get("dataMode", "limited")
    reason = asset.get("reasonForInclusion", "")
    summary = complete_sentence_summary(
        f"{asset['name']} is classified as {action}. "
        + (f"{reason} " if reason else "")
        + f"Technical setup: {technical.get('breakoutStatus', 'limited data')}; "
        f"fundamental score {fundamental.get('fundamentalScore', 50)} with {fundamental.get('dataCompleteness', 'low')} data completeness. "
        f"Liquidity: {liquidity.get('liquidityScore', 50)}. This is decision-support research, not a return promise."
    )
    return validate_asset_insight({
        "instrumentName": asset["name"],
        "assetType": asset.get("assetType", asset.get("assetClass", "")),
        "category": _category(asset, action),
        "summary": summary,
        "suitabilityNotes": complete_sentence_summary(f"Action: {action}. Buy range: {technical.get('buyRange', 'limited data')}. Allocation cap must respect profile and goal priority.", 220),
        "riskNotes": complete_sentence_summary(f"{liquidity.get('riskNotes', '')} Technical signals can fail; watchlist is not a buy recommendation.", 220),
        "evidence": evidence,
        "dataMode": data_mode,
        "confidenceScore": round((technical.get("confidenceScore", 45) + fundamental.get("fundamentalScore", 50) + liquidity.get("liquidityScore", 50)) / 3),
        "retrievedAt": now_iso(),
    }, llm_enhance=False)


def _research_row(db: Session, row: AssetResearch) -> dict:
    ticker = _ticker_for_name(row.instrument_name)
    technical = db.query(TechnicalIndicator).filter(TechnicalIndicator.asset_name == row.instrument_name).order_by(TechnicalIndicator.id.desc()).first()
    fundamental = db.query(FundamentalMetric).filter(FundamentalMetric.asset_name == row.instrument_name).order_by(FundamentalMetric.id.desc()).first()
    liquidity = db.query(AssetLiquidityScore).filter(AssetLiquidityScore.asset_name == row.instrument_name).order_by(AssetLiquidityScore.id.desc()).first()
    risk = db.query(AssetRiskScore).filter(AssetRiskScore.asset_name == row.instrument_name).order_by(AssetRiskScore.id.desc()).first()
    alpha = db.query(AlphaOpportunity).filter(AlphaOpportunity.asset_name == row.instrument_name).order_by(AlphaOpportunity.id.desc()).first()
    crypto = db.query(CryptoAssetResearch).filter(CryptoAssetResearch.asset_name == row.instrument_name).order_by(CryptoAssetResearch.id.desc()).first()
    return {
        "assetName": row.instrument_name,
        "ticker": ticker,
        "assetType": row.asset_type,
        "category": row.category,
        "summary": row.summary,
        "suitabilityNotes": row.suitability_notes,
        "riskNotes": row.risk_notes,
        "evidence": _loads(row.evidence_json),
        "evidenceCount": len(_loads(row.evidence_json)),
        "confidenceScore": row.confidence_score,
        "dataMode": row.data_mode,
        "retrievedAt": row.retrieved_at,
        "technical": _technical_row(technical) if technical else None,
        "fundamental": _fundamental_row(fundamental) if fundamental else None,
        "liquidity": _liquidity_row(liquidity) if liquidity else None,
        "risk": _risk_row(risk) if risk else None,
        "alpha": _alpha_row(alpha) if alpha else None,
        "crypto": _crypto_row(crypto) if crypto else None,
    }


def _save_technical(db: Session, asset: dict, technical: dict) -> None:
    db.add(
        TechnicalIndicator(
            asset_symbol=asset.get("ticker", ""),
            asset_name=asset["name"],
            asset_type=asset.get("assetType", asset.get("assetClass", "")),
            latest_price=technical.get("latestPrice"),
            moving_average_20=technical.get("movingAverage20"),
            moving_average_50=technical.get("movingAverage50"),
            moving_average_200=technical.get("movingAverage200"),
            rsi=technical.get("rsi"),
            macd=technical.get("macd"),
            volume_spike=technical.get("volumeSpike", "limited data"),
            relative_strength=technical.get("relativeStrength", 50),
            volatility=technical.get("volatility", 50),
            support_zone=technical.get("supportZone", ""),
            resistance_zone=technical.get("resistanceZone", ""),
            breakout_status=technical.get("breakoutStatus", "limited data"),
            trend_strength=technical.get("trendStrength", 50),
            drawdown=technical.get("drawdown"),
            buy_range=technical.get("buyRange", ""),
            review_zone=technical.get("reviewZone", ""),
            stop_loss_reference=technical.get("stopLossReference", ""),
            confidence_score=technical.get("confidenceScore", 50),
            data_mode=technical.get("dataMode", "limited"),
            source_url=technical.get("sourceUrl", ""),
            retrieved_at=now_iso(),
        )
    )
    db.commit()


def _save_fundamental(db: Session, asset: dict, fundamental: dict) -> None:
    db.add(
        FundamentalMetric(
            asset_symbol=asset.get("ticker", ""),
            asset_name=asset["name"],
            data_completeness=fundamental.get("dataCompleteness", "low"),
            revenue_growth_trend=fundamental.get("revenueGrowthTrend", "limited data"),
            profit_growth_trend=fundamental.get("profitGrowthTrend", "limited data"),
            margin_trend=fundamental.get("marginTrend", "limited data"),
            debt_level=fundamental.get("debtLevel", "limited data"),
            roe_roce=fundamental.get("roeRoce", "limited data"),
            valuation_proxy=fundamental.get("valuationProxy", "limited data"),
            earnings_momentum=fundamental.get("earningsMomentum", "limited data"),
            promoter_holding=fundamental.get("promoterHolding", "limited data"),
            institutional_holding=fundamental.get("institutionalHolding", "limited data"),
            sector_tailwind_score=fundamental.get("sectorTailwindScore", 50),
            recent_news_sentiment=fundamental.get("recentNewsSentiment", "neutral"),
            corporate_action_risk=fundamental.get("corporateActionRisk", "limited data"),
            fundamental_score=fundamental.get("fundamentalScore", 50),
            evidence_json=json.dumps(fundamental.get("evidence", [])),
            data_mode=fundamental.get("dataMode", "limited"),
            retrieved_at=now_iso(),
        )
    )
    db.commit()


def _save_liquidity_and_risk(db: Session, asset: dict, liquidity: dict) -> None:
    db.add(
        AssetLiquidityScore(
            asset_symbol=asset.get("ticker", ""),
            asset_name=asset["name"],
            market_cap_tier=liquidity.get("marketCapTier", "unknown"),
            volume_score=liquidity.get("volumeScore", 50),
            liquidity_score=liquidity.get("liquidityScore", 50),
            minimum_liquidity_passed="yes" if liquidity.get("minimumLiquidityPassed") else "no",
            liquidity_notes=liquidity.get("liquidityNotes", ""),
            data_mode="limited",
            retrieved_at=now_iso(),
        )
    )
    db.add(
        AssetRiskScore(
            asset_symbol=asset.get("ticker", ""),
            asset_name=asset["name"],
            risk_category=liquidity.get("riskCategory", "medium"),
            volatility_score=liquidity.get("volatilityScore", 50),
            drawdown_score=liquidity.get("drawdownScore", 50),
            concentration_risk=liquidity.get("concentrationRisk", ""),
            suitability_risk=liquidity.get("suitabilityRisk", ""),
            risk_notes=liquidity.get("riskNotes", ""),
            retrieved_at=now_iso(),
        )
    )
    db.commit()


def _save_crypto(db: Session, crypto: dict) -> None:
    db.add(
        CryptoAssetResearch(
            asset_name=crypto["asset"],
            symbol=crypto["ticker"],
            narrative=crypto["narrative"],
            market_cap_tier=crypto["marketCapTier"],
            liquidity_score=crypto["liquidityScore"],
            volatility_score=crypto["volatilityScore"],
            narrative_strength=crypto["narrativeStrength"],
            evidence_score=crypto["evidenceScore"],
            recommended_action=crypto["recommendedAction"],
            allocation_cap=crypto["allocationCap"],
            risk_warning=crypto["riskWarning"],
            evidence_json=json.dumps(crypto.get("evidence", [])),
            data_mode=crypto.get("dataMode", "limited"),
            retrieved_at=now_iso(),
        )
    )
    db.commit()


def _save_alpha(db: Session, item: dict) -> None:
    db.add(
        AlphaOpportunity(
            asset_name=item["assetName"],
            ticker=item.get("ticker", ""),
            asset_type=item.get("assetType", ""),
            bucket=item["bucket"],
            non_obvious_reason=item["nonObviousReason"],
            key_signal=item["keySignal"],
            supporting_signals_json=json.dumps(item.get("supportingSignals", [])),
            conflicting_signals_json=json.dumps(item.get("conflictingSignals", [])),
            asymmetry_score=item["asymmetryScore"],
            novelty_score=item["noveltyScore"],
            evidence_score=item["evidenceScore"],
            risk_adjusted_score=item["riskAdjustedScore"],
            suggested_action=item["suggestedAction"],
            allocation_cap=item["allocationCap"],
            invalidation_trigger=item["invalidationTrigger"],
            risk_label=item["riskLabel"],
            retrieved_at=now_iso(),
        )
    )
    db.commit()


def _technical_row(row: TechnicalIndicator | None) -> dict:
    if row is None:
        return {}
    return {
        "assetName": row.asset_name,
        "ticker": row.asset_symbol,
        "latestPrice": row.latest_price,
        "movingAverage20": row.moving_average_20,
        "movingAverage50": row.moving_average_50,
        "movingAverage200": row.moving_average_200,
        "rsi": row.rsi,
        "macd": row.macd,
        "volumeSpike": row.volume_spike,
        "relativeStrength": row.relative_strength,
        "volatility": row.volatility,
        "supportZone": row.support_zone,
        "resistanceZone": row.resistance_zone,
        "breakoutStatus": row.breakout_status,
        "trendStrength": row.trend_strength,
        "drawdown": row.drawdown,
        "buyRange": row.buy_range,
        "reviewZone": row.review_zone,
        "stopLossReference": row.stop_loss_reference,
        "confidenceScore": row.confidence_score,
        "dataMode": row.data_mode,
        "sourceUrl": row.source_url,
        "retrievedAt": row.retrieved_at,
    }


def _fundamental_row(row: FundamentalMetric | None) -> dict:
    if row is None:
        return {}
    return {
        "assetName": row.asset_name,
        "ticker": row.asset_symbol,
        "dataCompleteness": row.data_completeness,
        "revenueGrowthTrend": row.revenue_growth_trend,
        "profitGrowthTrend": row.profit_growth_trend,
        "marginTrend": row.margin_trend,
        "debtLevel": row.debt_level,
        "roeRoce": row.roe_roce,
        "valuationProxy": row.valuation_proxy,
        "earningsMomentum": row.earnings_momentum,
        "promoterHolding": row.promoter_holding,
        "institutionalHolding": row.institutional_holding,
        "sectorTailwindScore": row.sector_tailwind_score,
        "recentNewsSentiment": row.recent_news_sentiment,
        "corporateActionRisk": row.corporate_action_risk,
        "fundamentalScore": row.fundamental_score,
        "evidence": _loads(row.evidence_json),
        "dataMode": row.data_mode,
        "retrievedAt": row.retrieved_at,
    }


def _liquidity_row(row: AssetLiquidityScore | None) -> dict:
    if row is None:
        return {}
    return {
        "assetName": row.asset_name,
        "ticker": row.asset_symbol,
        "marketCapTier": row.market_cap_tier,
        "volumeScore": row.volume_score,
        "liquidityScore": row.liquidity_score,
        "minimumLiquidityPassed": row.minimum_liquidity_passed == "yes",
        "liquidityNotes": row.liquidity_notes,
        "dataMode": row.data_mode,
        "retrievedAt": row.retrieved_at,
    }


def _risk_row(row: AssetRiskScore | None) -> dict:
    if row is None:
        return {}
    return {
        "assetName": row.asset_name,
        "ticker": row.asset_symbol,
        "riskCategory": row.risk_category,
        "volatilityScore": row.volatility_score,
        "drawdownScore": row.drawdown_score,
        "concentrationRisk": row.concentration_risk,
        "suitabilityRisk": row.suitability_risk,
        "riskNotes": row.risk_notes,
        "retrievedAt": row.retrieved_at,
    }


def _alpha_row(row: AlphaOpportunity | None) -> dict:
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
    }


def _crypto_row(row: CryptoAssetResearch | None) -> dict:
    if row is None:
        return {}
    return {
        "narrative": row.narrative,
        "marketCapTier": row.market_cap_tier,
        "liquidityScore": row.liquidity_score,
        "volatilityScore": row.volatility_score,
        "narrativeStrength": row.narrative_strength,
        "evidenceScore": row.evidence_score,
        "recommendedAction": row.recommended_action,
        "allocationCap": row.allocation_cap,
        "riskWarning": row.risk_warning,
    }


def _sector_scores_from_impact_maps(impact_maps: list[dict]) -> list[dict]:
    scores = {}
    for impact in impact_maps:
        for sector in impact.get("affectedSectors", []):
            score = scores.setdefault(sector, {"sector": sector, "relativeStrengthScore": 50})
            score["relativeStrengthScore"] = max(score["relativeStrengthScore"], impact.get("confidenceScore", 50))
    return list(scores.values())


def _dedupe_assets(assets: list[dict]) -> list[dict]:
    seen = {}
    for asset in assets:
        if not asset.get("name"):
            continue
        current = seen.setdefault(asset["name"], {**asset, "sourceSignals": [], "evidence": []})
        current["sourceSignals"].extend(asset.get("sourceSignals", []))
        current["evidence"].extend(asset.get("evidence", []))
        current["sectors"] = list(set(current.get("sectors", []) + asset.get("sectors", [])))
    return list(seen.values())


def _action(liquidity: dict, technical: dict, fundamental: dict, crypto: dict | None) -> str:
    if crypto:
        return crypto.get("recommendedAction", "watchlist")
    if not liquidity.get("minimumLiquidityPassed"):
        return "watchlist"
    if liquidity.get("riskCategory") in {"high", "extreme"}:
        return "watchlist"
    if technical.get("trendStrength", 0) >= 68 and fundamental.get("fundamentalScore", 0) >= 62:
        return "accumulate"
    if technical.get("breakoutStatus") == "breakdown risk":
        return "avoid"
    return "watchlist"


def _category(asset: dict, action: str) -> str:
    if asset.get("assetClass") == "crypto":
        return "Crypto " + action
    if action == "accumulate":
        return "Asset intelligence accumulate candidate"
    return "Asset intelligence watchlist"


def _combined_mode(assets: list[dict]) -> str:
    modes = [asset.get("dataMode", "limited") for asset in assets]
    if "live" in modes:
        return "live"
    if "cached" in modes:
        return "cached"
    return "limited"


def _ticker_for_name(name: str) -> str:
    for asset in base_asset_universe():
        if asset["name"] == name:
            return asset.get("ticker", "")
    return ""


def _yahoo_symbol(ticker: str) -> str:
    if ticker == "BTC":
        return "BTC-USD"
    if ticker == "ETH":
        return "ETH-USD"
    if ticker == "SOL":
        return "SOL-USD"
    if ticker == "LINK":
        return "LINK-USD"
    return ticker


def _loads(value: str) -> list:
    try:
        return json.loads(value or "[]")
    except json.JSONDecodeError:
        return []
