from __future__ import annotations

from app.services.recommendations.asset_screening_service import ResearchAsset
from app.services.recommendations.suitability_scoring_service import ProfileContext


NARRATIVES = {
    "Bitcoin": "Bitcoin store-of-value / liquidity-cycle narrative",
    "Ethereum": "Ethereum ecosystem / smart-contract infrastructure narrative",
    "Solana": "Layer-1 throughput and consumer crypto narrative",
    "Chainlink": "Tokenized real-world assets and oracle infrastructure narrative",
}


def analyze_crypto_narrative(asset: ResearchAsset, context: ProfileContext, signals: list[dict]) -> dict:
    narrative = NARRATIVES.get(asset.instrument_name, "Large-cap crypto infrastructure narrative")
    crypto_signal_count = sum(1 for signal in signals if "crypto" in " ".join(signal.get("assetClasses", [])).lower() or signal.get("signalType") == "crypto signal")
    allowed = context.short_term_risk_ok and context.emergency_gap <= 0 and context.savings_rate >= 15
    confidence = 44 + crypto_signal_count * 6 + (12 if allowed else -12)
    if asset.instrument_name not in {"Bitcoin", "Ethereum"}:
        confidence -= 8
    confidence = max(20, min(82, confidence))
    return {
        "narrative": narrative,
        "allowed": allowed,
        "confidence": confidence,
        "allocationCap": 5 if asset.instrument_name in {"Bitcoin", "Ethereum"} else 2,
        "actionBias": "Watchlist" if confidence < 60 or not allowed else "Accumulate gradually",
        "warning": "Crypto is extreme-risk. Keep it capped, avoid leverage, and do not use money needed for essential goals.",
    }
