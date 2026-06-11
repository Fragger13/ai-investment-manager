from __future__ import annotations

from app.services.intelligence import now_iso
from app.services.recommendations.asset_screening_service import ResearchAsset
from app.services.recommendations.suitability_scoring_service import ProfileContext


def discover_alpha_assets(existing_names: set[str], signals: list[dict], context: ProfileContext, regime: dict) -> list[ResearchAsset]:
    if context.surplus <= 0:
        return []
    timestamp = now_iso()
    candidates = [
        _candidate(
            "Bharat Electronics Ltd",
            "Equity share",
            "Event-driven defence opportunity",
            "Defence electronics candidate tied to defence capex and geopolitical risk themes. This is not a core holding; size it as a capped tactical idea.",
            "Use only for users who can accept stock-specific and valuation risk.",
            "Order execution, valuation compression, policy delays, and broad market corrections can hurt returns.",
            "https://www.nseindia.com/get-quotes/equity?symbol=BEL",
            timestamp,
            66,
        ),
        _candidate(
            "Larsen & Toubro Ltd",
            "Equity share",
            "Event-driven infrastructure capex opportunity",
            "Infrastructure and capital-goods proxy for public/private capex tailwinds. It is more cyclical than an index fund.",
            "Suitable as a small goal-aligned equity satellite when long-term risk capacity exists.",
            "Execution delays, margin pressure, election/policy shifts, and valuation risk can affect outcomes.",
            "https://www.nseindia.com/get-quotes/equity?symbol=LT",
            timestamp,
            68,
        ),
        _candidate(
            "Kaynes Technology India Ltd",
            "Equity share",
            "Underdog electronics manufacturing opportunity",
            "Higher-risk electronics manufacturing candidate linked to India manufacturing and EV/electronics supply-chain themes.",
            "Watchlist or very small tactical allocation only for aggressive profiles.",
            "Small/mid-cap valuation, execution, liquidity, and margin risks are high.",
            "https://www.nseindia.com/get-quotes/equity?symbol=KAYNES",
            timestamp,
            58,
        ),
        _candidate(
            "KPIT Technologies Ltd",
            "Equity share",
            "Underdog EV software opportunity",
            "Auto software candidate linked to EV and software-defined vehicle themes. Treat as a high-risk watchlist idea unless evidence strengthens.",
            "Suitable only as a capped satellite for users with high risk comfort.",
            "Client concentration, growth normalization, valuation, and technology-cycle risks are high.",
            "https://www.nseindia.com/get-quotes/equity?symbol=KPITTECH",
            timestamp,
            58,
        ),
        _candidate(
            "Solana",
            "Crypto asset",
            "Crypto tactical watchlist",
            "Large-cap layer-1 crypto watchlist idea for high-risk profiles only. Prefer watchlist until source-backed crypto signals improve.",
            "Only suitable after emergency fund and core investments are in place.",
            "Extreme volatility, outages, regulatory uncertainty, liquidity stress, and narrative reversal can cause large losses.",
            "https://www.coingecko.com/en/coins/solana",
            timestamp,
            50,
        ),
        _candidate(
            "Chainlink",
            "Crypto asset",
            "Crypto narrative watchlist",
            "Oracle and tokenized real-world asset narrative watchlist idea. Keep as watchlist unless evidence and risk capacity are strong.",
            "Only suitable as a tiny speculative watchlist for aggressive users.",
            "Protocol competition, token economics, regulation, and crypto market drawdowns can hurt returns.",
            "https://www.coingecko.com/en/coins/chainlink",
            timestamp,
            48,
        ),
    ]
    allowed = []
    text = " ".join(f"{signal.get('summary', '')} {' '.join(signal.get('sectors', []))} {' '.join(signal.get('macroThemes', []))}" for signal in signals).lower()
    for candidate in candidates:
        if candidate.instrument_name in existing_names:
            continue
        if candidate.asset_key == "crypto" and not context.short_term_risk_ok:
            continue
        if "defence" in candidate.category.lower() and not any(term in text for term in ["defence", "geopolitical", "budget", "capex"]):
            candidate.confidence_score -= 6
        if "infrastructure" in candidate.category.lower() and not any(term in text for term in ["infra", "capex", "budget", "construction"]):
            candidate.confidence_score -= 6
        if "underdog" in candidate.category.lower() and regime.get("regime") == "risk-off":
            candidate.confidence_score -= 8
        allowed.append(candidate)
    return allowed


def discover_alpha_opportunities(assets: list[dict], market_signals: list[dict], technicals: dict[str, dict], fundamentals: dict[str, dict], liquidity: dict[str, dict], regime: dict) -> list[dict]:
    opportunities = []
    for asset in assets:
        name = asset["name"]
        tech = technicals.get(name, {})
        fund = fundamentals.get(name, {})
        liq = liquidity.get(name, {})
        if not liq.get("minimumLiquidityPassed", False):
            suggested_action = "watchlist"
        else:
            suggested_action = "accumulate" if tech.get("trendStrength", 0) >= 65 and fund.get("fundamentalScore", 0) >= 62 else "watchlist"
        if asset.get("assetClass") == "crypto":
            continue
        source_signals = _related_signals(asset, market_signals)
        novelty = _novelty(asset)
        asymmetry = _asymmetry(asset, tech, fund, regime)
        evidence = min(90, 35 + len(source_signals) * 10 + (10 if fund.get("dataCompleteness") == "medium" else 0))
        risk_adjusted = max(20, min(90, round((asymmetry * 0.35 + evidence * 0.3 + fund.get("fundamentalScore", 50) * 0.2 + tech.get("trendStrength", 50) * 0.15) - _risk_penalty(liq))))
        bucket = _bucket(asset, novelty, source_signals, regime)
        if bucket == "core":
            continue
        if evidence < 55 or risk_adjusted < 55:
            suggested_action = "watchlist"
        opportunities.append(
            {
                "assetName": name,
                "ticker": asset.get("ticker", ""),
                "assetType": asset.get("assetType", asset.get("assetClass", "")),
                "bucket": bucket,
                "nonObviousReason": _non_obvious_reason(asset, bucket),
                "keySignal": source_signals[0].get("summary", asset.get("reasonForInclusion", "Sector-linked opportunity")) if source_signals else asset.get("reasonForInclusion", "Sector-linked opportunity"),
                "supportingSignals": [signal.get("summary", "") for signal in source_signals if signal.get("sentiment") != "bearish"][:4],
                "conflictingSignals": [signal.get("summary", "") for signal in source_signals if signal.get("sentiment") == "bearish"][:3],
                "asymmetryScore": asymmetry,
                "noveltyScore": novelty,
                "evidenceScore": evidence,
                "riskAdjustedScore": risk_adjusted,
                "suggestedAction": suggested_action,
                "allocationCap": _allocation_cap(bucket, liq),
                "invalidationTrigger": _invalidation_trigger(asset, tech),
                "riskLabel": liq.get("riskCategory", "high"),
            }
        )
    return sorted(opportunities, key=lambda item: (item["suggestedAction"] != "watchlist", item["riskAdjustedScore"]), reverse=True)[:12]


def _related_signals(asset: dict, signals: list[dict]) -> list[dict]:
    terms = {asset["name"].lower(), asset.get("ticker", "").replace(".NS", "").lower(), *(sector.lower() for sector in asset.get("sectors", []))}
    matches = []
    for signal in signals:
        haystack = " ".join(
            [
                signal.get("summary", ""),
                " ".join(signal.get("sectors", [])),
                " ".join(signal.get("likelyBeneficiaries", [])),
                " ".join(signal.get("relevantInstruments", [])),
            ]
        ).lower()
        if any(term and term in haystack for term in terms):
            matches.append(signal)
    return matches[:6]


def _novelty(asset: dict) -> int:
    text = f"{asset.get('assetType', '')} {asset.get('name', '')}".lower()
    if any(term in text for term in ["electronics", "defence", "real estate", "nbfc", "capital goods"]):
        return 72
    if any(term in text for term in ["bank", "it services", "large-cap"]):
        return 42
    return 58


def _asymmetry(asset: dict, technical: dict, fundamental: dict, regime: dict) -> int:
    score = 45 + (technical.get("trendStrength", 50) - 50) // 2 + (fundamental.get("fundamentalScore", 50) - 50) // 2
    if regime.get("regimeName", regime.get("regime", "")) in {"risk-off", "bear market"}:
        score -= 8
    if "watchlist" in asset.get("reasonForInclusion", "").lower():
        score -= 4
    return max(20, min(88, score))


def _risk_penalty(liquidity: dict) -> int:
    if liquidity.get("riskCategory") == "extreme":
        return 22
    if liquidity.get("riskCategory") == "high":
        return 12
    return 4


def _bucket(asset: dict, novelty: int, signals: list[dict], regime: dict) -> str:
    text = f"{asset.get('assetType', '')} {asset.get('sectors', [])} {asset.get('name', '')}".lower()
    if novelty >= 65:
        return "underdog"
    if any(term in text for term in ["defence", "capital goods", "infrastructure", "real estate"]):
        return "event_driven"
    if any(signal.get("signalType") in {"technical", "risk warning"} for signal in signals):
        return "tactical"
    if regime.get("regimeName", regime.get("regime", "")) in {"bear market", "risk-off"}:
        return "contrarian"
    return "core"


def _non_obvious_reason(asset: dict, bucket: str) -> str:
    if bucket == "underdog":
        return "This is a less obvious sector-linked idea; keep sizing small until evidence and liquidity improve."
    if bucket == "event_driven":
        return "This may benefit from policy, capex, or macro events, but execution and valuation risk remain."
    if bucket == "contrarian":
        return "This is a contrarian setup because market stress may create selective entry zones."
    return "This is a tactical setup; use evidence and technical confirmation before acting."


def _allocation_cap(bucket: str, liquidity: dict) -> int:
    if liquidity.get("riskCategory") in {"high", "extreme"}:
        return 2
    if bucket in {"underdog", "contrarian"}:
        return 3
    if bucket == "event_driven":
        return 5
    return 4


def _invalidation_trigger(asset: dict, technical: dict) -> str:
    stop = technical.get("stopLossReference")
    if stop:
        return stop
    return "Invalidate the thesis if sector signal weakens, liquidity dries up, or company-specific risk worsens."


def _candidate(name: str, asset_type: str, category: str, summary: str, suitability: str, risk: str, source_url: str, timestamp: str, confidence: int) -> ResearchAsset:
    return ResearchAsset(
        instrument_name=name,
        asset_type=asset_type,
        category=category,
        summary=f"{summary} Data mode: limited public reference; verify live price, liquidity, valuation, and filings before acting.",
        suitability_notes=suitability,
        risk_notes=risk,
        evidence=[{"sourceName": "Public market reference", "sourceUrl": source_url, "dataMode": "limited"}],
        data_mode="limited",
        confidence_score=confidence,
        retrieved_at=timestamp,
    )
