from app.agents.source_credibility_agent import score_signal
from app.services.research.signal_extraction_service import extract_signal


def extract_news_signals(articles: list[dict]) -> list[dict]:
    signals = []
    for article in articles:
        signal = extract_signal(article)
        signal["confidenceScore"] = score_signal(
            signal["confidenceScore"],
            signal["credibilityScore"],
            signal["dataMode"],
            signal["relevanceScore"],
        )
        signals.append(signal)
    return signals
