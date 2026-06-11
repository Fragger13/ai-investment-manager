from __future__ import annotations

from hashlib import sha1

from app.services.recommendations.asset_screening_service import ResearchAsset, signals_for_asset


def select_investment_candidates(assets: list[ResearchAsset], signals: list[dict], goals: list[dict], cluster: dict) -> list[dict]:
    candidates = []
    for asset in assets:
        supporting, conflicting = signals_for_asset(asset, signals)
        bucket = _bucket(asset, supporting, conflicting)
        liquidity_ok = _liquidity_check(asset)
        minimum_data = bool(asset.evidence) or asset.data_mode in {"live", "cached", "delayed"}
        if asset.asset_key == "crypto" and cluster.get("cryptoAllocationCap", 0) <= 0:
            bucket = "watchlist"
        if not minimum_data or not liquidity_ok:
            bucket = "watchlist"
        candidates.append(
            {
                "id": _candidate_id(asset.instrument_name),
                "name": asset.instrument_name,
                "ticker": _ticker(asset.instrument_name),
                "assetClass": asset.asset_type,
                "bucket": bucket,
                "sourceSignals": [signal.get("title") or signal.get("summary", "")[:80] for signal in supporting[:4]],
                "linkedGoals": [goal["name"] for goal in goals if asset.asset_key in goal.get("eligibleAssetKeys", [])][:3],
                "reasonForInclusion": _reason(asset, bucket, supporting),
                "minimumDataAvailable": minimum_data,
                "liquidityCheckPassed": liquidity_ok,
                "initialRiskFlag": _risk_flag(asset),
            }
        )
    return candidates


def candidate_lookup(candidates: list[dict]) -> dict[str, dict]:
    return {candidate["name"]: candidate for candidate in candidates}


def _candidate_id(name: str) -> str:
    return "cand-" + sha1(name.encode("utf-8")).hexdigest()[:10]


def _bucket(asset: ResearchAsset, supporting: list[dict], conflicting: list[dict]) -> str:
    text = f"{asset.instrument_name} {asset.asset_type} {asset.category}".lower()
    if asset.asset_key == "debt" or "liquid" in text:
        return "defensive"
    if asset.asset_key == "gold":
        return "defensive"
    if asset.asset_key == "crypto":
        return "crypto" if supporting and not conflicting else "watchlist"
    if "underdog" in text or "emerging" in text:
        return "underdog" if len(supporting) >= 2 else "watchlist"
    if "event-driven" in text or "defence" in text or "infrastructure" in text or "capex" in text:
        return "event_driven"
    if asset.asset_key == "tactical" or "sector" in text:
        return "tactical" if supporting else "watchlist"
    if "index" in text or "nifty" in text or "large-cap" in text:
        return "core"
    return "core"


def _risk_flag(asset: ResearchAsset) -> str:
    if asset.asset_key == "crypto":
        return "extreme"
    if asset.asset_key == "tactical" or any(term in asset.category.lower() for term in ["underdog", "event-driven"]):
        return "high"
    if asset.asset_key in {"equity", "gold"}:
        return "medium"
    return "low"


def _liquidity_check(asset: ResearchAsset) -> bool:
    text = f"{asset.instrument_name} {asset.asset_type} {asset.category}".lower()
    blocked = ["penny", "microcap", "illiquid", "meme"]
    return not any(term in text for term in blocked)


def _reason(asset: ResearchAsset, bucket: str, supporting: list[dict]) -> str:
    if supporting:
        return f"Included because {len(supporting)} relevant market update(s) support this idea."
    return "Included for further review because the available supporting information is limited."


def _ticker(name: str) -> str:
    return {
        "HDFC Bank Ltd": "HDFCBANK",
        "ICICI Bank Ltd": "ICICIBANK",
        "Reliance Industries Ltd": "RELIANCE",
        "Infosys Ltd": "INFY",
        "Bharat Electronics Ltd": "BEL",
        "Larsen & Toubro Ltd": "LT",
        "Kaynes Technology India Ltd": "KAYNES",
        "KPIT Technologies Ltd": "KPITTECH",
        "Bitcoin": "BTC",
        "Ethereum": "ETH",
        "Solana": "SOL",
        "Chainlink": "LINK",
    }.get(name, "")
