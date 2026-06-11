from __future__ import annotations


def detect_sector_rotation(signals: list[dict]) -> dict:
    sector_scores: dict[str, int] = {}
    sector_confidence: dict[str, list[int]] = {}
    for signal in signals[:80]:
        direction = 1 if signal.get("sentiment") == "bullish" else -1 if signal.get("sentiment") == "bearish" else 0
        confidence = max(1, signal.get("confidenceScore", 50) // 10)
        for sector in signal.get("sectors", []):
            sector_scores[sector] = sector_scores.get(sector, 0) + direction * confidence
            sector_confidence.setdefault(sector, []).append(signal.get("confidenceScore", 50))
    leaders = sorted(((sector, score) for sector, score in sector_scores.items() if score > 0), key=lambda item: item[1], reverse=True)
    laggards = sorted(((sector, score) for sector, score in sector_scores.items() if score < 0), key=lambda item: item[1])
    all_scores = [
        {
            "sector": sector,
            "direction": "improving" if score > 3 else "weakening" if score < -3 else "neutral",
            "relativeStrengthScore": max(5, min(95, 50 + score * 3)),
            "earningsMomentumScore": 50,
            "valuationComfortScore": 50 if abs(score) < 10 else 42,
            "macroSupportScore": max(10, min(90, 50 + score * 2)),
            "riskScore": max(10, min(90, 50 - score * 2 if score > 0 else 50 + abs(score) * 2)),
            "confidenceScore": round(sum(sector_confidence.get(sector, [50])) / len(sector_confidence.get(sector, [50]))),
            "recommendedAction": "accumulate" if score > 8 else "watchlist" if score > 0 else "avoid" if score < -8 else "watchlist",
            "explanation": f"Sector signal score is {score} across current source-backed signals.",
        }
        for sector, score in sector_scores.items()
    ]
    return {
        "leaders": [{"sector": sector, "score": score} for sector, score in leaders[:5]],
        "laggards": [{"sector": sector, "score": abs(score)} for sector, score in laggards[:5]],
        "scores": sorted(all_scores, key=lambda item: item["relativeStrengthScore"], reverse=True),
        "summary": _summary(leaders, laggards),
    }


def sector_score_for_asset(asset_name: str, asset_category: str, rotation: dict) -> int:
    haystack = f"{asset_name} {asset_category}".lower()
    score = 0
    for item in rotation.get("leaders", []):
        if item["sector"].lower() in haystack:
            score += min(20, item["score"] * 2)
    for item in rotation.get("laggards", []):
        if item["sector"].lower() in haystack:
            score -= min(16, item["score"] * 2)
    return score


def _summary(leaders: list[tuple[str, int]], laggards: list[tuple[str, int]]) -> str:
    if leaders:
        return f"Current source set shows improving relative signal for {leaders[0][0]}."
    if laggards:
        return f"Current source set flags pressure in {laggards[0][0]}."
    return "No strong sector rotation signal is visible yet."
