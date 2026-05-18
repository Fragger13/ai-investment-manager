# Advanced Research Intelligence Architecture

## Goal

Build a scalable research-backed recommendation system that moves beyond generic asset-class suggestions. The system should collect structured data, source-backed research, news/RSS signals, fund information, macro context, and user profile context, then generate exact decision-support recommendations with sources, timestamps, suitability scores, and risk explanations.

## Target Pipeline

```text
User Financial Profile
→ Structured Market Data Layer
→ Research Source Registry
→ Connector Layer
→ Content Extraction Layer
→ Financial NLP / Signal Extraction Layer
→ Signal Scoring Engine
→ Source Credibility Engine
→ Recommendation Engine
→ Action Plan Generator
→ UI with Sources
```

## Source Ingestion Approach

Source priority:

1. Official and structured sources: AMFI, NSE, BSE, RBI, SEBI, AMC fund pages, fund factsheets.
2. Public APIs: yfinance, CoinGecko, Alpha Vantage, Twelve Data, News API where configured.
3. RSS feeds and public pages: Moneycontrol, Economic Times, LiveMint, Investing.com, Zerodha Varsity, ValueResearch, Morningstar where accessible.
4. Lightweight page extraction only where legally allowed.

Phase 1 uses a configurable source registry and connector interfaces. It does not perform uncontrolled crawling. RSS/API services are structured so they can fetch from enabled sources, but failures or missing API keys are recorded as limited/fallback mode. Fallback research data is clearly labelled and never presented as live market data.

## Source Registry

Each source has:

- `source_name`
- `source_type`: `official`, `api`, `rss`, `article`, `factsheet`
- `base_url`
- `reliability_score`
- `allowed_ingestion_method`
- `refresh_frequency`
- `categories_covered`
- `enabled`

The registry is the only place where ingestion eligibility is configured. Scrapers must not invent new crawl targets at runtime.

## Database Changes

Phase 1 adds:

- `research_sources`: registry rows and reliability metadata.
- `research_articles`: RSS/API/public item metadata, summaries, source URL, timestamps, and optional raw text only when allowed.
- `market_signals`: extracted bullish, bearish, neutral, risk, sector, macro, and fund-specific signals.
- `asset_research`: instrument-level research such as exact fund/ETF/instrument names, asset type, source mode, and evidence.
- `recommendation_sources`: links generated recommendations to source URLs and supporting signals.
- `source_refresh_logs`: refresh attempts, status, mode, and errors.

The existing `recommendations` table remains available for recommendation payloads. A later migration can normalize advanced recommendation fields into dedicated columns.

## API Changes

Phase 1 adds:

- `POST /api/v1/research/refresh`
- `GET /api/v1/research/sources`
- `GET /api/v1/research/signals`
- `GET /api/v1/research/assets`
- `POST /api/v1/recommendations/generate-advanced`
- `GET /api/v1/recommendations/latest`
- `GET /api/v1/recommendations/{id}/sources`

## Signal Extraction

Every source item is normalized into:

- title
- summary
- mentioned asset classes
- mentioned instruments
- sectors
- macro themes
- sentiment
- risk signals
- opportunity signals
- relevance score
- source URL
- published date
- retrieved timestamp

Phase 1 uses deterministic keyword and registry-backed extraction. Later phases can add LLM-assisted extraction, embeddings, contradiction detection, and source clustering.

## Recommendation Output

Each advanced recommendation includes:

- recommendation title
- exact asset/instrument name
- asset type
- suggested monthly amount
- suggested allocation percentage
- priority order
- user-specific reasoning
- current market reasoning
- supporting signals
- contradictory signals
- risk explanation
- what can go wrong
- action plan
- entry approach
- review date
- exit/rebalance condition
- source links
- data timestamp
- confidence score
- suitability score
- data mode: `live`, `cached`, `fallback`, or `limited`

## Legal And Safety Limits

- Do not bypass paywalls.
- Do not login as a user.
- Do not use human-mimicking browser automation as the default.
- Do not aggressively crawl.
- Respect robots.txt, website terms, API limits, and source-specific ingestion settings.
- Prefer official APIs, official pages, RSS feeds, and cached data.
- Store retrieval timestamps and source URLs.
- Label cached, limited, and fallback data clearly.
- Recommendations are research-backed decision-support outputs, not guaranteed financial advice.

## Implementation Phases

### Phase 1: Research Foundation

Implemented now:

- Source registry.
- Research database models.
- RSS/API ingestion service structure.
- Market signal model and deterministic signal extraction.
- Advanced recommendation response schema.
- Advanced recommendation API.
- Recommendations UI redesign with source count, timestamps, suitability, evidence, filters, sort, refresh, and fallback/live labels.
- No uncontrolled web scraping.

### Phase 2: Live Structured Data

Later:

- yfinance and CoinGecko integrations.
- Alpha Vantage, Twelve Data, News API when keys exist.
- AMFI/NSE/BSE structured data adapters where terms allow.
- Robust source refresh scheduling and cache expiry policies.

### Phase 3: Research NLP

Later:

- LLM-assisted extraction using `OPENAI_API_KEY`.
- Signal clustering, contradiction detection, and source corroboration.
- Instrument-level research summaries from factsheets and official pages.

### Phase 4: Personalization And Review

Later:

- Recommendation versioning and diffing.
- “What changed since last recommendation?”
- Goal-specific recommendation optimization.
- Human-review workflows for high-risk or low-confidence outputs.

## What Phase 1 Does Not Do

- It does not scrape arbitrary websites.
- It does not bypass access controls.
- It does not present fallback source data as live data.
- It does not promise returns.
- It does not replace suitability checks, advisor review, or user verification.
