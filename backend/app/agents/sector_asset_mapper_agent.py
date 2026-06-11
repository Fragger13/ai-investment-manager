from __future__ import annotations


SECTOR_ASSET_MAP = {
    "banks": [
        {"name": "HDFC Bank Ltd", "ticker": "HDFCBANK.NS", "assetClass": "stock", "assetType": "large-cap bank", "sectors": ["banks", "banking"]},
        {"name": "ICICI Bank Ltd", "ticker": "ICICIBANK.NS", "assetClass": "stock", "assetType": "large-cap bank", "sectors": ["banks", "banking"]},
        {"name": "Nippon India ETF Bank BeES", "ticker": "BANKBEES.NS", "assetClass": "ETF", "assetType": "banking ETF", "sectors": ["banks", "banking"]},
    ],
    "banking": [
        {"name": "HDFC Bank Ltd", "ticker": "HDFCBANK.NS", "assetClass": "stock", "assetType": "large-cap bank", "sectors": ["banks", "banking"]},
        {"name": "ICICI Bank Ltd", "ticker": "ICICIBANK.NS", "assetClass": "stock", "assetType": "large-cap bank", "sectors": ["banks", "banking"]},
    ],
    "nbfcs": [
        {"name": "Bajaj Finance Ltd", "ticker": "BAJFINANCE.NS", "assetClass": "stock", "assetType": "large-cap NBFC", "sectors": ["NBFCs"]},
    ],
    "real estate": [
        {"name": "DLF Ltd", "ticker": "DLF.NS", "assetClass": "stock", "assetType": "real estate leader", "sectors": ["real estate"]},
    ],
    "autos": [
        {"name": "Tata Motors Ltd", "ticker": "TATAMOTORS.NS", "assetClass": "stock", "assetType": "auto leader", "sectors": ["autos"]},
        {"name": "Maruti Suzuki India Ltd", "ticker": "MARUTI.NS", "assetClass": "stock", "assetType": "auto leader", "sectors": ["autos"]},
    ],
    "capital goods": [
        {"name": "Larsen & Toubro Ltd", "ticker": "LT.NS", "assetClass": "stock", "assetType": "capital goods leader", "sectors": ["capital goods", "infrastructure"]},
        {"name": "Siemens Ltd", "ticker": "SIEMENS.NS", "assetClass": "stock", "assetType": "capital goods leader", "sectors": ["capital goods"]},
    ],
    "cement": [
        {"name": "UltraTech Cement Ltd", "ticker": "ULTRACEMCO.NS", "assetClass": "stock", "assetType": "cement leader", "sectors": ["cement"]},
    ],
    "steel": [
        {"name": "JSW Steel Ltd", "ticker": "JSWSTEEL.NS", "assetClass": "stock", "assetType": "steel leader", "sectors": ["steel"]},
    ],
    "defence": [
        {"name": "Bharat Electronics Ltd", "ticker": "BEL.NS", "assetClass": "stock", "assetType": "defence electronics", "sectors": ["defence"]},
        {"name": "Hindustan Aeronautics Ltd", "ticker": "HAL.NS", "assetClass": "stock", "assetType": "aerospace defence", "sectors": ["defence"]},
    ],
    "it": [
        {"name": "Infosys Ltd", "ticker": "INFY.NS", "assetClass": "stock", "assetType": "IT services leader", "sectors": ["IT"]},
        {"name": "TCS Ltd", "ticker": "TCS.NS", "assetClass": "stock", "assetType": "IT services leader", "sectors": ["IT"]},
    ],
    "pharma": [
        {"name": "Sun Pharmaceutical Industries Ltd", "ticker": "SUNPHARMA.NS", "assetClass": "stock", "assetType": "pharma leader", "sectors": ["pharma"]},
    ],
    "energy": [
        {"name": "ONGC Ltd", "ticker": "ONGC.NS", "assetClass": "stock", "assetType": "upstream oil", "sectors": ["energy", "upstream oil"]},
        {"name": "Reliance Industries Ltd", "ticker": "RELIANCE.NS", "assetClass": "stock", "assetType": "diversified energy/consumer", "sectors": ["energy", "consumer"]},
    ],
    "gold": [
        {"name": "Nippon India ETF Gold BeES", "ticker": "GOLDBEES.NS", "assetClass": "ETF", "assetType": "gold ETF", "sectors": ["gold"]},
    ],
    "crypto": [
        {"name": "Bitcoin", "ticker": "BTC", "assetClass": "crypto", "assetType": "large-cap crypto", "sectors": ["crypto"]},
        {"name": "Ethereum", "ticker": "ETH", "assetClass": "crypto", "assetType": "large-cap crypto", "sectors": ["crypto"]},
        {"name": "Solana", "ticker": "SOL", "assetClass": "crypto", "assetType": "large-cap layer-1 crypto", "sectors": ["crypto"]},
        {"name": "Chainlink", "ticker": "LINK", "assetClass": "crypto", "assetType": "oracle / RWA crypto", "sectors": ["crypto"]},
    ],
}


def map_signals_to_assets(signals: list[dict], impact_maps: list[dict]) -> list[dict]:
    candidates: dict[str, dict] = {}
    for signal in signals:
        for asset in _assets_for_terms(signal.get("likelyBeneficiaries", []) + signal.get("sectors", []) + signal.get("assetClasses", [])):
            _merge_candidate(candidates, asset, signal)
    for impact in impact_maps:
        terms = impact.get("likelyBeneficiaries", []) + impact.get("affectedSectors", []) + impact.get("affectedAssetClasses", [])
        for asset in _assets_for_terms(terms):
            _merge_candidate(candidates, asset, impact)
    return list(candidates.values())


def base_asset_universe() -> list[dict]:
    assets: dict[str, dict] = {}
    for group in SECTOR_ASSET_MAP.values():
        for asset in group:
            assets.setdefault(asset["name"], {**asset, "sourceSignals": [], "evidence": []})
    return list(assets.values())


def _assets_for_terms(terms: list[str]) -> list[dict]:
    assets = []
    for term in terms:
        key = term.lower()
        if key in SECTOR_ASSET_MAP:
            assets.extend(SECTOR_ASSET_MAP[key])
    return assets


def _merge_candidate(candidates: dict[str, dict], asset: dict, source: dict) -> None:
    current = candidates.setdefault(asset["name"], {**asset, "sourceSignals": [], "evidence": []})
    summary = source.get("summary") or source.get("shortTermImpact") or source.get("title", "")
    if summary:
        current["sourceSignals"].append(summary)
    if source.get("sourceUrl"):
        current["evidence"].append(
            {
                "sourceName": source.get("sourceName", "Market intelligence"),
                "sourceUrl": source.get("sourceUrl", ""),
                "summary": summary,
                "confidenceScore": source.get("confidenceScore", 50),
                "retrievedAt": source.get("retrievedAt", ""),
            }
        )
