from app.services.research.market_data_service import structured_market_fallback


def macro_signals() -> list[dict]:
    return [signal for signal in structured_market_fallback() if "rates" in signal.get("macroThemes", []) or "volatility" in signal.get("macroThemes", [])]
