"""Asset universe for the analysis pipeline.

No assets are hardcoded here anymore. The recommendation engine sources every
asset class dynamically from live data and computes real factors:
- equities  -> live NSE index constituents (``equity_factor_service``)
- crypto    -> live CoinGecko top-market-cap coins (``crypto_factor_service``)
- funds     -> live AMFI universe (``fund_factor_service``)

These shims remain only because legacy callers import them.
"""

from __future__ import annotations


def map_signals_to_assets(signals: list[dict], impact_maps: list[dict]) -> list[dict]:
    """Deprecated: news no longer maps to a hardcoded ticker table. Sector
    relevance flows through sector-rotation scoring on the dynamic universe."""
    return []


def base_asset_universe() -> list[dict]:
    """Deprecated: assets are sourced dynamically per class. Returns nothing."""
    return []
