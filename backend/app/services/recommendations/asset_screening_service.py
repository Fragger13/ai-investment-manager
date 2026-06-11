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
        if "tactical" in text or "sector rotation" in text:
            return "tactical"
        if "liquid" in text or "debt" in text:
            return "debt"
        if "crypto" in text or self.instrument_name.lower() in {"bitcoin", "ethereum"}:
            return "crypto"
        if "gold" in text:
            return "gold"
        if "stock" in text or "share" in text or "equity" in text:
            return "equity"
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


# Brand-name prefixes commonly produced by legacy hardcoded code paths.
# We only block these when the underlying data source is INTERNAL FALLBACK
# (i.e. synthetic records). If the same name shows up via genuine research
# (live RSS, AMFI API, news article, etc.), it's allowed through because
# that's real research-backed evidence — exactly the kind of recommendation
# the engine should be able to surface.
_LEGACY_BRAND_PREFIXES = (
    "Nippon India ETF",
    "SBI ",
    "ICICI Prudential",
    "UTI Nifty",
    "UTI Mid",
    "UTI Small",
    "HDFC Index",
    "HDFC Mid",
    "HDFC Small",
    "Motilal Oswal Nifty",
    "Parag Parikh",
    "Edelweiss US",
    "Bharat Bond",
    "Sovereign Gold Bond",
    "Mirae Asset",
    "Kotak ",
    "Axis Bluechip",
    "DSP Nifty",
)


def _has_brand_prefix(name: str) -> bool:
    if not name:
        return False
    return any(name.startswith(prefix) for prefix in _LEGACY_BRAND_PREFIXES)


def _is_synthetic_fallback(data_mode: str, evidence: list[dict]) -> bool:
    """Return True only for records whose data lineage is internal/fallback.

    Genuine research (live/cached/delayed data, real external source URLs)
    is NOT considered synthetic, even when the asset name matches a brand
    pattern — that's a real signal worth surfacing.
    """
    if (data_mode or "").lower() == "fallback":
        return True
    for item in evidence or []:
        url = str(item.get("sourceUrl") or "").lower()
        if url.startswith("internal://") or url.startswith("internal:") or not url:
            # Empty URL OR explicit internal:// prefix → synthetic origin.
            # But require at least one such marker to flip the verdict, so a
            # single rich evidence item is enough to "rescue" the record.
            continue
        # Found a real external source URL → not synthetic.
        return False
    # No external source URL anywhere in evidence → treat as synthetic.
    return bool(evidence) or (data_mode or "").lower() in {"", "fallback"}


def latest_research_assets(db: Session, limit: int = 60) -> list[ResearchAsset]:
    rows = db.query(AssetResearch).order_by(AssetResearch.retrieved_at.desc()).limit(limit * 2).all()
    assets: list[ResearchAsset] = []
    seen = set()
    for row in rows:
        if row.instrument_name in seen:
            continue
        evidence = _loads(row.evidence_json)
        # Only skip brand-named records when their lineage is synthetic.
        # Real research that names a specific product is allowed through.
        if _has_brand_prefix(row.instrument_name) and _is_synthetic_fallback(row.data_mode, evidence):
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
                evidence=evidence,
                data_mode=row.data_mode,
                confidence_score=row.confidence_score,
                retrieved_at=row.retrieved_at,
            )
        )
        if len(assets) >= limit:
            break
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
    """Return assets sourced from the live research pipeline only.

    We deliberately do NOT synthesize specific instrument names from a
    hardcoded template list — that would surface the same "Nippon India
    ETF X" / "ICICI Prudential Y" on every profile regardless of what
    research actually supports. Recommendations must be backed by real
    research records ingested into `AssetResearch`. If the pipeline is
    empty, recommendations are empty until the user (or a worker) refreshes
    research data.
    """
    assets = latest_research_assets(db)
    signals = latest_market_signals(db)
    priority_order = {"debt": 0, "equity": 1, "gold": 2, "crypto": 3, "other": 4}
    return (
        sorted(assets, key=lambda asset: (priority_order.get(asset.asset_key, 9), -asset.confidence_score)),
        signals,
    )
