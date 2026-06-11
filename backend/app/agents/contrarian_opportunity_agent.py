from __future__ import annotations

from app.services.recommendations.asset_screening_service import ResearchAsset


def identify_contrarian_setup(asset: ResearchAsset, supporting: list[dict], conflicting: list[dict], regime: dict) -> dict:
    if asset.asset_key not in {"equity", "tactical", "gold", "crypto"}:
        return {"contrarianScore": 20, "summary": "Not a contrarian setup.", "isContrarian": False}
    support = len(supporting)
    conflicts = len(conflicting)
    score = 35 + conflicts * 10 + support * 4
    if regime.get("regime") == "risk-off" and asset.asset_key in {"equity", "tactical", "crypto"}:
        score += 8
    if "underdog" in asset.category.lower() or "emerging" in asset.category.lower():
        score += 14
    score = max(10, min(88, score))
    return {
        "contrarianScore": score,
        "isContrarian": score >= 58,
        "summary": "Potential contrarian/watchlist setup because risk signals may be masking a medium-term theme." if score >= 58 else "No strong contrarian edge yet.",
    }
