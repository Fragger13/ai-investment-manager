from __future__ import annotations

from statistics import mean
import re

from app.services.recommendations.asset_screening_service import ResearchAsset


# No hardcoded per-stock fundamentals. Real fundamentals (revenue/margins/ROE/
# valuation) require a dedicated data source; until that exists, stock selection
# rests on the quantitative factor engine (price-based, risk-adjusted) plus the
# news-derived sector sentiment below — never on fabricated per-name scores.
FUNDAMENTAL_HINTS: dict[str, tuple[str, int]] = {}


def analyze_fundamentals(asset: ResearchAsset) -> dict:
    note, score = FUNDAMENTAL_HINTS.get(
        asset.instrument_name,
        ("Fundamental data is limited; verify revenue growth, margins, debt, ROE/ROCE, promoter holding, and latest filings before acting.", 55),
    )
    if asset.asset_key not in {"equity", "tactical"}:
        score = 55
    return {
        "fundamentalScore": score,
        "summary": note,
        "dataMode": "limited",
        "dataCompleteness": "low" if score <= 58 else "medium",
        "revenueGrowthTrend": "limited data",
        "profitGrowthTrend": "limited data",
        "marginTrend": "limited data",
        "debtLevel": "limited data",
        "roeRoce": "limited data",
        "valuationProxy": "limited data",
        "earningsMomentum": "limited data",
        "promoterHolding": "limited data",
        "institutionalHolding": "limited data",
        "sectorTailwindScore": score,
        "recentNewsSentiment": "neutral",
        "corporateActionRisk": "limited data",
        "signals": [
            "Revenue/profit trend requires latest filing verification",
            "Debt and margin trend should be checked before position sizing",
            "Valuation can override a good business thesis",
        ],
    }


def analyze_fundamental_metrics(asset: dict, market_signals: list[dict], sector_tailwinds: list[dict] | None = None) -> dict:
    name = asset["name"]
    note, base_score = FUNDAMENTAL_HINTS.get(
        name,
        ("Fundamental data is limited; latest filings are required before this can be a high-conviction idea.", 52),
    )
    related_signals = _related_signals(asset, market_signals)
    sentiment_scores = [signal.get("confidenceScore", 50) for signal in related_signals if signal.get("sentiment") == "bullish"]
    negative_scores = [signal.get("confidenceScore", 50) for signal in related_signals if signal.get("sentiment") == "bearish"]
    tailwind_score = _sector_tailwind_score(asset, sector_tailwinds or [], related_signals)
    score = base_score + round((mean(sentiment_scores) - 55) / 5) if sentiment_scores else base_score
    if negative_scores:
        score -= round((mean(negative_scores) - 45) / 6)
    score = max(25, min(88, round(score * 0.7 + tailwind_score * 0.3)))
    data_completeness = "medium" if name in FUNDAMENTAL_HINTS else "low"
    return {
        "assetName": name,
        "ticker": asset.get("ticker", ""),
        "dataCompleteness": data_completeness,
        "revenueGrowthTrend": "qualitative positive/monitor" if score >= 68 else "limited data",
        "profitGrowthTrend": "qualitative positive/monitor" if score >= 70 else "limited data",
        "marginTrend": "needs latest filing verification",
        "debtLevel": "needs latest filing verification",
        "roeRoce": "needs latest filing verification",
        "valuationProxy": "valuation can override a good business thesis",
        "earningsMomentum": "supported by recent source sentiment" if sentiment_scores else "limited data",
        "promoterHolding": "limited data",
        "institutionalHolding": "limited data",
        "sectorTailwindScore": tailwind_score,
        "recentNewsSentiment": _sentiment_label(related_signals),
        "corporateActionRisk": "check latest exchange announcements before action",
        "fundamentalScore": score,
        "summary": note,
        "evidence": _evidence(related_signals),
        "dataMode": "limited" if data_completeness == "low" else "cached",
    }


def _related_signals(asset: dict, market_signals: list[dict]) -> list[dict]:
    terms = {
        asset["name"].lower(),
        asset.get("ticker", "").replace(".NS", "").lower(),
        *(_sector_terms(sector) for sector in asset.get("sectors", [])),
    }
    terms = {term for term in terms if term and (len(term) > 3 or term in {"it"})}
    matches = []
    for signal in market_signals:
        haystack = " ".join(
            [
                signal.get("title", ""),
                signal.get("summary", ""),
                " ".join(signal.get("sectors", [])),
                " ".join(signal.get("instruments", [])),
                " ".join(signal.get("likelyBeneficiaries", [])),
            ]
        ).lower()
        if any(_contains_term(haystack, term) for term in terms):
            matches.append(signal)
    return matches[:8]


def _sector_terms(sector: str) -> str:
    value = sector.lower()
    if value == "it":
        return "it services"
    return value


def _contains_term(text: str, term: str) -> bool:
    if len(term) <= 3:
        return bool(re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", text))
    return term in text


def _sector_tailwind_score(asset: dict, sector_tailwinds: list[dict], signals: list[dict]) -> int:
    sectors = {sector.lower() for sector in asset.get("sectors", [])}
    score = 50
    for item in sector_tailwinds:
        if item.get("sector", "").lower() in sectors:
            score = max(score, int(item.get("relativeStrengthScore", 50)))
    if any(signal.get("sentiment") == "bullish" for signal in signals):
        score += 8
    if any(signal.get("sentiment") == "bearish" for signal in signals):
        score -= 6
    return max(20, min(90, score))


def _sentiment_label(signals: list[dict]) -> str:
    bullish = sum(1 for signal in signals if signal.get("sentiment") == "bullish")
    bearish = sum(1 for signal in signals if signal.get("sentiment") == "bearish")
    if bullish > bearish:
        return "positive"
    if bearish > bullish:
        return "negative"
    if bullish and bearish:
        return "mixed"
    return "neutral"


def _evidence(signals: list[dict]) -> list[dict]:
    return [
        {
            "sourceName": signal.get("sourceName", ""),
            "sourceUrl": signal.get("sourceUrl", ""),
            "summary": signal.get("summary", ""),
            "signalType": signal.get("signalType", ""),
            "confidenceScore": signal.get("confidenceScore", 50),
            "retrievedAt": signal.get("retrievedAt", ""),
        }
        for signal in signals[:5]
    ]
