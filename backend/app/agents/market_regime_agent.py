from __future__ import annotations


def assess_market_regime(signals: list[dict]) -> dict:
    recent = signals[:60]
    if not recent:
        return {
            "regime": "limited-data",
            "regimeName": "limited-data",
            "confidenceScore": 25,
            "summary": "Market regime could not be strongly classified because current research signals are limited.",
            "riskScore": 50,
            "equityBias": 0,
            "debtBias": 10,
            "goldBias": 5,
            "cryptoBias": -10,
            "drivers": ["Limited source-backed market signals"],
            "supportingEvidence": [],
            "contradictoryEvidence": [],
            "recommendedPortfolioStance": "Keep allocation conservative until more live evidence is available.",
            "reviewCadence": "Review after the next research refresh.",
        }

    bullish = sum(1 for item in recent if item.get("sentiment") == "bullish")
    bearish = sum(1 for item in recent if item.get("sentiment") == "bearish")
    risk_warnings = sum(1 for item in recent if item.get("signalType") == "risk warning" or item.get("riskSignals"))
    opportunities = sum(1 for item in recent if item.get("opportunitySignals"))
    text = " ".join(
        " ".join(
            [
            item.get("summary", ""),
            " ".join(item.get("macroThemes", [])),
            " ".join(item.get("riskSignals", [])),
            " ".join(item.get("opportunitySignals", [])),
            ]
        )
        for item in recent
    ).lower()
    volatility = _contains_any(text, ["volatility", "volatile", "correction", "selloff", "drawdown"])
    inflation = _contains_any(text, ["inflation", "cpi", "prices"])
    rates = _contains_any(text, ["rbi", "rate", "repo", "yield", "liquidity"])
    oil = _contains_any(text, ["oil", "crude", "fuel"])
    liquidity = _contains_any(text, ["liquidity", "inflow", "vrr", "repo"])
    technical_momentum = sum(1 for item in recent if item.get("signalType") in {"market trend", "technical"} and item.get("sentiment") == "bullish")
    defensive = _contains_any(text, ["gold", "defensive", "safe haven", "risk warning"])

    risk_score = 45 + (bearish * 4) + (risk_warnings * 3) - (bullish * 3) - opportunities
    if volatility:
        risk_score += 10
    if inflation or rates:
        risk_score += 4
    risk_score = max(10, min(95, risk_score))

    if risk_score >= 76 and bearish > bullish:
        regime = "bear market"
        summary = "Bearish and risk-warning evidence is elevated. Use strict position sizing and avoid aggressive tactical entries."
        equity_bias, debt_bias, gold_bias, crypto_bias = -18, 18, 10, -18
        review = "Review every 15-30 days until risk signals cool."
    elif risk_score >= 68:
        regime = "risk-off"
        summary = "Signals point to a cautious market regime. Position sizing should be conservative, with more emphasis on liquidity and staggered entry."
        equity_bias, debt_bias, gold_bias, crypto_bias = -10, 15, 8, -15
        review = "Review every 30 days or after a sharp market move."
    elif volatility:
        regime = "high volatility"
        summary = "Volatility language is visible across the source set. Prefer staggered entry and tighter review triggers."
        equity_bias, debt_bias, gold_bias, crypto_bias = -6, 10, 8, -12
        review = "Review every 30 days or after a sharp market move."
    elif inflation or oil:
        regime = "inflationary"
        summary = "Inflation, commodity, or oil-linked signals are visible. Watch margin pressure and keep diversification hedges active."
        equity_bias, debt_bias, gold_bias, crypto_bias = -4, 8, 10, -8
        review = "Review after inflation, currency, or oil data changes."
    elif rates:
        regime = "rate-sensitive"
        summary = "Rates and liquidity are important drivers right now. Rate-sensitive sectors need staggered entries and closer monitoring."
        equity_bias, debt_bias, gold_bias, crypto_bias = 0, 8, 4, -8
        review = "Review after RBI/rate/liquidity updates."
    elif risk_score <= 38:
        regime = "risk-on"
        summary = "Signals lean constructive. Long-term allocations can continue, but entries should still be tied to goal timelines and risk capacity."
        equity_bias, debt_bias, gold_bias, crypto_bias = 10, -5, 0, 3
        review = "Review every 60-90 days unless risk signals rise."
    elif liquidity:
        regime = "liquidity-driven"
        summary = "Liquidity language is supporting market appetite. Avoid chasing; use allocation caps and evidence quality checks."
        equity_bias, debt_bias, gold_bias, crypto_bias = 6, 0, 2, 0
        review = "Review after liquidity or central-bank updates."
    elif technical_momentum >= 4:
        regime = "momentum-led"
        summary = "Technical and momentum signals are constructive, but entries should remain gradual because momentum can reverse."
        equity_bias, debt_bias, gold_bias, crypto_bias = 8, -2, 2, 0
        review = "Review every 30-45 days."
    elif defensive:
        regime = "defensive"
        summary = "Defensive signals are visible. Keep hedges and emergency liquidity prioritized."
        equity_bias, debt_bias, gold_bias, crypto_bias = -4, 12, 8, -10
        review = "Review every 45 days."
    else:
        regime = "bull market" if bullish > bearish + 5 else "balanced"
        summary = "Signals are mixed. A diversified plan with SIP-style entry is preferred over aggressive lump-sum timing."
        equity_bias, debt_bias, gold_bias, crypto_bias = 0, 5, 3, -5
        review = "Review every 45-60 days."

    drivers = []
    if bullish:
        drivers.append(f"{bullish} bullish signal(s)")
    if bearish:
        drivers.append(f"{bearish} bearish signal(s)")
    if risk_warnings:
        drivers.append(f"{risk_warnings} risk warning(s)")
    if volatility:
        drivers.append("Volatility/correction language detected")
    if rates:
        drivers.append("Rates/liquidity themes detected")
    if inflation:
        drivers.append("Inflation themes detected")
    if oil:
        drivers.append("Oil/commodity pressure detected")
    if liquidity:
        drivers.append("Liquidity themes detected")

    supporting = _evidence_for(recent, regime, bullish=True)
    contradictory = _evidence_for(recent, regime, bullish=False)
    confidence = max(35, min(92, 100 - abs(50 - risk_score) + min(12, len(drivers) * 2)))
    stance = _portfolio_stance(regime)

    return {
        "regime": regime,
        "regimeName": regime,
        "confidenceScore": confidence,
        "summary": summary,
        "riskScore": risk_score,
        "equityBias": equity_bias,
        "debtBias": debt_bias,
        "goldBias": gold_bias,
        "cryptoBias": crypto_bias,
        "drivers": drivers or ["Mixed market signals"],
        "supportingEvidence": supporting,
        "contradictoryEvidence": contradictory,
        "recommendedPortfolioStance": stance,
        "reviewCadence": review,
    }


def _contains_any(value: str, terms: list[str]) -> bool:
    return any(term in value for term in terms)


def _evidence_for(signals: list[dict], regime: str, bullish: bool) -> list[dict]:
    selected = []
    for signal in signals:
        sentiment = signal.get("sentiment")
        risk_signal = signal.get("signalType") == "risk warning" or bool(signal.get("riskSignals"))
        supports_risk_off = regime in {"risk-off", "bear market", "high volatility", "defensive", "inflationary"} and (sentiment == "bearish" or risk_signal)
        supports_risk_on = regime in {"risk-on", "bull market", "momentum-led", "liquidity-driven"} and sentiment == "bullish"
        supports = supports_risk_off or supports_risk_on
        if supports == bullish:
            selected.append(
                {
                    "sourceName": signal.get("sourceName", ""),
                    "sourceUrl": signal.get("sourceUrl", ""),
                    "summary": signal.get("summary", "")[:240],
                    "sentiment": sentiment,
                    "confidenceScore": signal.get("confidenceScore", 50),
                    "retrievedAt": signal.get("retrievedAt", ""),
                }
            )
        if len(selected) >= 5:
            break
    return selected


def _portfolio_stance(regime: str) -> str:
    if regime in {"risk-off", "bear market", "high volatility"}:
        return "Prefer staggered entries, higher liquidity, capped tactical exposure, and active risk review."
    if regime in {"inflationary", "defensive"}:
        return "Keep emergency money and defensive hedges visible; avoid overconcentration in rate- or oil-sensitive sectors."
    if regime in {"risk-on", "bull market", "momentum-led", "liquidity-driven"}:
        return "Core SIPs can continue; tactical ideas still need allocation caps and evidence checks."
    if regime == "rate-sensitive":
        return "Review debt duration and rate-sensitive equity exposure before adding aggressive positions."
    return "Maintain diversified allocation and use SIP-style entry until signals become clearer."
