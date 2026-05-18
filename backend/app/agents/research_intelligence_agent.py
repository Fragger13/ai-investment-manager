from __future__ import annotations

from sqlalchemy.orm import Session

from app.agents.market_data_agent import fetch_market_data
from app.agents.news_sentiment_agent import extract_news_signals
from app.services.intelligence import now_iso
from app.services.research.crypto_research_service import fetch_crypto_research
from app.services.research.fund_research_service import amfi_assets_to_signals, fetch_fund_research
from app.services.research.rss_ingestion_service import configured_rss_sources, fetch_rss_source
from app.services.research.source_cache_service import log_refresh, save_articles, save_assets, save_signals, seed_sources
from app.services.research.source_registry import limited_mode_reason, source_registry


def refresh_research(db: Session, force: bool = False) -> dict:
    sources = source_registry()
    seed_sources(db, sources)

    articles: list[dict] = []
    modes: list[str] = []
    for source in configured_rss_sources(sources)[:8]:
        items, mode, message = fetch_rss_source(source)
        modes.append(mode)
        log_refresh(db, source.source_name, "ok" if items else "failed", mode, message, len(items))
        articles.extend(items[:8])

    saved_articles = save_articles(db, articles) if articles else []
    article_payloads = [
        {
            "title": item.title,
            "summary": item.summary,
            "sourceName": item.source_name,
            "sourceUrl": item.source_url,
            "publishedAt": item.published_at,
            "retrievedAt": item.retrieved_at,
            "credibilityScore": item.credibility_score,
            "extractionMode": item.extraction_mode,
        }
        for item in saved_articles
    ]

    market_data = fetch_market_data()
    market_signals = market_data["signals"]
    market_mode = market_data["status"]["dataMode"]
    modes.append(market_mode)
    log_refresh(db, "Yahoo Finance", "ok" if market_signals else "failed", market_mode, market_data["status"]["message"], len(market_signals))

    fund_assets, fund_mode, fund_message = fetch_fund_research()
    modes.append(fund_mode)
    log_refresh(db, "AMFI India", "ok" if fund_assets else "failed", fund_mode, fund_message, len(fund_assets))
    fund_signals = amfi_assets_to_signals(fund_assets)

    crypto_assets, crypto_signals, crypto_mode, crypto_message = fetch_crypto_research()
    modes.append(crypto_mode)
    log_refresh(db, "CoinGecko", "ok" if crypto_assets else "failed", crypto_mode, crypto_message, len(crypto_assets))

    extracted_signals = extract_news_signals(article_payloads) if article_payloads else []
    signals = market_signals + fund_signals + crypto_signals + extracted_signals
    if not signals:
        from app.services.research.market_data_service import structured_market_fallback

        signals = structured_market_fallback()
        modes.append("fallback")

    saved_signals = save_signals(db, signals)
    saved_assets = save_assets(db, fund_assets + crypto_assets)
    if any(mode == "live" for mode in modes):
        data_mode = "live"
    elif any(mode == "cached" for mode in modes):
        data_mode = "cached"
    elif any(mode == "delayed" for mode in modes):
        data_mode = "delayed"
    elif any(mode == "limited" for mode in modes):
        data_mode = "limited"
    else:
        data_mode = "fallback"
    return {
        "status": "refreshed",
        "dataMode": data_mode,
        "sourcesProcessed": len(configured_rss_sources(sources)) + 3,
        "articlesProcessed": len(saved_articles),
        "signalsGenerated": len(saved_signals),
        "assetsGenerated": len(saved_assets),
        "message": limited_mode_reason(),
        "retrievedAt": now_iso(),
    }
