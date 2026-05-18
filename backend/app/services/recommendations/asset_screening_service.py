from __future__ import annotations

import json
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.asset_research import AssetResearch
from app.models.market_signal import MarketSignal


@dataclass
class ResearchAsset:
    instrument_name: str
    asset_type: str
    category: str
    summary: str
    suitability_notes: str
    risk_notes: str
    evidence: list[dict]
    data_mode: str
    confidence_score: int
    retrieved_at: str

    @property
    def asset_key(self) -> str:
        text = f"{self.instrument_name} {self.asset_type} {self.category}".lower()
        if "liquid" in text or "debt" in text:
            return "debt"
        if "crypto" in text or self.instrument_name.lower() in {"bitcoin", "ethereum"}:
            return "crypto"
        if "gold" in text:
            return "gold"
        if "etf" in text:
            return "equity"
        if "index" in text or "mutual fund" in text:
            return "equity"
        return "other"


def _loads(value: str) -> list:
    try:
        return json.loads(value or "[]")
    except json.JSONDecodeError:
        return []


def latest_research_assets(db: Session, limit: int = 60) -> list[ResearchAsset]:
    rows = db.query(AssetResearch).order_by(AssetResearch.retrieved_at.desc()).limit(limit).all()
    assets: list[ResearchAsset] = []
    seen = set()
    for row in rows:
        if row.instrument_name in seen:
            continue
        seen.add(row.instrument_name)
        assets.append(
            ResearchAsset(
                instrument_name=row.instrument_name,
                asset_type=row.asset_type,
                category=row.category,
                summary=row.summary,
                suitability_notes=row.suitability_notes,
                risk_notes=row.risk_notes,
                evidence=_loads(row.evidence_json),
                data_mode=row.data_mode,
                confidence_score=row.confidence_score,
                retrieved_at=row.retrieved_at,
            )
        )
    live_assets = [asset for asset in assets if asset.data_mode in {"live", "cached", "delayed"}]
    return live_assets or assets


def latest_market_signals(db: Session, limit: int = 100) -> list[dict]:
    rows = db.query(MarketSignal).order_by(MarketSignal.retrieved_at.desc()).limit(limit).all()
    signals = []
    seen = set()
    for row in rows:
        key = (row.source_url, row.signal_type, row.summary)
        if key in seen:
            continue
        seen.add(key)
        signals.append(
            {
                "id": row.id,
                "title": row.summary[:90],
                "summary": row.summary,
                "signalType": row.signal_type,
                "sentiment": row.sentiment,
                "assetClasses": _loads(row.asset_classes),
                "instruments": _loads(row.instruments),
                "sectors": _loads(row.sectors),
                "macroThemes": _loads(row.macro_themes),
                "riskSignals": _loads(row.risk_signals),
                "opportunitySignals": _loads(row.opportunity_signals),
                "relevanceScore": row.relevance_score,
                "credibilityScore": row.credibility_score,
                "confidenceScore": row.confidence_score,
                "sourceName": row.source_name,
                "sourceUrl": row.source_url,
                "publishedAt": row.published_at,
                "retrievedAt": row.retrieved_at,
                "dataMode": row.data_mode,
                "relatedRecommendation": None,
            }
        )
    live_signals = [signal for signal in signals if signal["dataMode"] in {"live", "cached", "delayed"}]
    return live_signals or signals


def signals_for_asset(asset: ResearchAsset, signals: list[dict]) -> tuple[list[dict], list[dict]]:
    name = asset.instrument_name.lower()
    key = asset.asset_key
    supporting = []
    conflicting = []
    for signal in signals:
        haystack = " ".join(
            [
                signal.get("summary", ""),
                " ".join(signal.get("instruments", [])),
                " ".join(signal.get("assetClasses", [])),
                " ".join(signal.get("sectors", [])),
                signal.get("signalType", ""),
            ]
        ).lower()
        related = name in haystack or key in haystack or (key == "equity" and ("nifty" in haystack or "market" in haystack))
        if not related:
            continue
        if signal.get("sentiment") == "bearish" or signal.get("signalType") == "risk warning":
            conflicting.append(signal)
        else:
            supporting.append(signal)
    return supporting[:4], conflicting[:3]


def screen_assets_for_recommendations(db: Session) -> tuple[list[ResearchAsset], list[dict]]:
    assets = latest_research_assets(db)
    signals = latest_market_signals(db)
    assets.extend(_signal_derived_assets(signals, {asset.instrument_name for asset in assets}))
    priority_order = {"debt": 0, "equity": 1, "gold": 2, "crypto": 3, "other": 4}
    return sorted(assets, key=lambda asset: (priority_order.get(asset.asset_key, 9), -asset.confidence_score)), signals


def _signal_derived_assets(signals: list[dict], existing_names: set[str]) -> list[ResearchAsset]:
    derived = []
    for signal in signals:
        instruments = set(signal.get("instruments", []))
        if "Gold ETF proxy" in instruments and "Nippon India ETF Gold BeES" not in existing_names:
            derived.append(
                ResearchAsset(
                    instrument_name="Nippon India ETF Gold BeES",
                    asset_type="Gold ETF",
                    category="Gold ETF",
                    summary=signal["summary"].replace("Gold ETF proxy", "Nippon India ETF Gold BeES"),
                    suitability_notes="Useful as a small gold allocation when diversification matters and liquidity is preferred over SGB lock-in.",
                    risk_notes="Gold ETF prices can move differently from equity and can underperform for long periods. Check tracking error and expense ratio.",
                    evidence=[{"sourceName": signal["sourceName"], "sourceUrl": signal["sourceUrl"], "dataMode": signal["dataMode"]}],
                    data_mode=signal["dataMode"],
                    confidence_score=signal["confidenceScore"],
                    retrieved_at=signal["retrievedAt"],
                )
            )
            existing_names.add("Nippon India ETF Gold BeES")
        if "Nippon India ETF Nifty 50 BeES" in instruments and "Nippon India ETF Nifty 50 BeES" not in existing_names:
            derived.append(
                ResearchAsset(
                    instrument_name="Nippon India ETF Nifty 50 BeES",
                    asset_type="ETF",
                    category="Nifty 50 ETF",
                    summary=signal["summary"],
                    suitability_notes="Useful for users comfortable buying ETFs through a brokerage account.",
                    risk_notes="ETF price can differ from NAV. Check liquidity, tracking error, and brokerage costs.",
                    evidence=[{"sourceName": signal["sourceName"], "sourceUrl": signal["sourceUrl"], "dataMode": signal["dataMode"]}],
                    data_mode=signal["dataMode"],
                    confidence_score=signal["confidenceScore"],
                    retrieved_at=signal["retrievedAt"],
                )
            )
            existing_names.add("Nippon India ETF Nifty 50 BeES")
    return derived
