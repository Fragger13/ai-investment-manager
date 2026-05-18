from app.services.research.market_data_service import fetch_structured_market_data, market_data_status, market_data_to_signals, structured_market_fallback


def fetch_market_data() -> dict:
    data = fetch_structured_market_data()
    signals = market_data_to_signals(data)
    status = market_data_status()
    if not signals:
        status["dataMode"] = "limited"
        status["message"] = "Yahoo Finance chart fetch did not return usable market data; fallback signals are labelled."
    return {"status": status, "raw": data, "signals": signals or structured_market_fallback()}
