from __future__ import annotations


CRYPTO_NARRATIVES = {
    "BTC": ("Bitcoin store-of-value", "large", 88, 82),
    "ETH": ("Ethereum ecosystem", "large", 84, 78),
    "SOL": ("Layer 1 throughput", "large", 72, 72),
    "LINK": ("DeFi infrastructure / tokenized real-world assets", "large", 68, 68),
}


def analyze_crypto_asset(asset: dict, signals: list[dict], risk_profile: str = "moderate") -> dict:
    ticker = asset.get("ticker", "")
    narrative, tier, liquidity, narrative_strength = CRYPTO_NARRATIVES.get(ticker, ("Large-cap crypto watchlist", "mid", 45, 45))
    related = [
        signal for signal in signals
        if "crypto" in " ".join(signal.get("assetClasses", []) + signal.get("sectors", [])).lower()
        or ticker.lower() in " ".join(signal.get("instruments", []) + [signal.get("summary", "")]).lower()
    ]
    bearish = sum(1 for signal in related if signal.get("sentiment") == "bearish")
    bullish = sum(1 for signal in related if signal.get("sentiment") == "bullish")
    evidence_score = min(85, 45 + len(related) * 6 + bullish * 5 - bearish * 4)
    risk_allowed = risk_profile in {"aggressive", "very_aggressive"}
    if ticker in {"BTC", "ETH"} and risk_profile == "moderate":
        risk_allowed = True
    action = "watchlist"
    if risk_allowed and evidence_score >= 70 and ticker in {"BTC", "ETH"}:
        action = "accumulate"
    allocation_cap = 5 if ticker in {"BTC", "ETH"} else 2
    if not risk_allowed:
        allocation_cap = 0
    return {
        "asset": asset["name"],
        "ticker": ticker,
        "narrative": narrative,
        "marketCapTier": tier,
        "liquidityScore": liquidity,
        "volatilityScore": 90 if ticker not in {"BTC", "ETH"} else 82,
        "narrativeStrength": narrative_strength,
        "evidenceScore": max(20, min(90, evidence_score)),
        "recommendedAction": action,
        "allocationCap": allocation_cap,
        "riskWarning": "Crypto is extreme-risk. Watchlist is not a buy recommendation. Avoid leverage and keep allocation capped.",
        "evidence": _evidence(related),
        "dataMode": "live" if any(signal.get("dataMode") == "live" for signal in related) else "limited",
    }


def _evidence(signals: list[dict]) -> list[dict]:
    return [
        {
            "sourceName": signal.get("sourceName", ""),
            "sourceUrl": signal.get("sourceUrl", ""),
            "summary": signal.get("summary", ""),
            "confidenceScore": signal.get("confidenceScore", 50),
            "retrievedAt": signal.get("retrievedAt", ""),
        }
        for signal in signals[:5]
    ]
