from __future__ import annotations

from app.services.intelligence import now_iso
from app.services.recommendations.asset_screening_service import ResearchAsset
from app.services.recommendations.suitability_scoring_service import ProfileContext


def discover_alpha_assets(existing_names: set[str], signals: list[dict], context: ProfileContext, regime: dict) -> list[ResearchAsset]:
    """Data-driven alpha: surface stocks from the LIVE NSE universe that are
    genuinely beating the market (positive alpha vs Nifty 50 + strong momentum),
    rather than a hardcoded watchlist. Crypto watchlist stays fixed until Pass 3.
    """
    if context.surplus <= 0:
        return []
    timestamp = now_iso()
    candidates: list[ResearchAsset] = []

    try:
        from app.services.research.equity_factor_service import top_equity_candidates

        pool = top_equity_candidates(limit=40, exclude=list(existing_names))
        # Rank by genuine outperformance: alpha vs Nifty 50 then 12m momentum.
        pool.sort(key=lambda c: ((c["factors"].get("alpha") or -99), (c["factors"].get("momentum12m") or -99)), reverse=True)
        for cand in pool:
            f = cand["factors"]
            alpha = f.get("alpha")
            if alpha is None or alpha <= 1.0:  # only real market-beaters
                continue
            bits = [f"alpha {alpha}% vs Nifty 50"]
            if f.get("momentum12m") is not None:
                bits.append(f"12m momentum {f['momentum12m']}%")
            if f.get("sortino") is not None:
                bits.append(f"Sortino {f['sortino']}")
            candidates.append(
                _candidate(
                    cand["name"],
                    "Equity share",
                    "Event-driven alpha opportunity",
                    f"{cand['name']} is beating the market on risk-adjusted terms ({', '.join(bits)}). "
                    "A capped, goal-aligned equity satellite — not a core holding.",
                    "Suitable as a small satellite for users with long-term risk capacity who accept single-stock risk.",
                    "Single-stock, valuation, sector-cycle, and broad-market drawdown risks apply.",
                    f"https://www.nseindia.com/get-quotes/equity?symbol={cand['ticker'].replace('.NS', '')}",
                    timestamp,
                    min(74, 55 + int(alpha)),
                )
            )
            if len(candidates) >= 4:
                break
    except Exception:  # noqa: BLE001 — equity data must never break discovery
        candidates = []

    # Crypto watchlist from the LIVE CoinGecko universe (no hardcoded coins):
    # the highest-momentum large-cap coins, for high-risk profiles only.
    if context.short_term_risk_ok:
        try:
            from app.services.research.crypto_factor_service import top_crypto_candidates

            pool = top_crypto_candidates(limit=12, exclude=list(existing_names))
            pool.sort(key=lambda c: (c["factors"].get("momentum12m") or -99), reverse=True)
            for cand in pool[:2]:
                f = cand["factors"]
                mom = f.get("momentum12m")
                if mom is None:
                    continue
                candidates.append(
                    _candidate(
                        cand["name"],
                        "Crypto asset",
                        "Crypto narrative watchlist",
                        f"{cand['name']} shows strong momentum ({mom}% 12m) in the live crypto universe; a tiny "
                        "speculative watchlist idea only — keep capped unless risk capacity is high.",
                        "Only suitable as a tiny speculative watchlist for aggressive users after core investing is in place.",
                        "Extreme volatility, regulation, liquidity stress, and narrative reversal can cause large losses.",
                        f"https://www.coingecko.com/en/coins/{cand['coinId']}",
                        timestamp,
                        50,
                    )
                )
        except Exception:  # noqa: BLE001
            pass

    return [c for c in candidates if c.instrument_name not in existing_names]


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
