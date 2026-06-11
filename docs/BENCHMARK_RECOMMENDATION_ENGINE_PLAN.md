# Benchmark Recommendation Engine Plan

## Current Gaps

- Source coverage is useful but still narrow and mostly tied to the original research registry.
- Recommendations and market signals have source links, but evidence is not stored as a reusable graph that can connect sources, signals, assets, and recommendations.
- Financial text processing is split across agents and needs a dedicated NLP layer for entity extraction, signal extraction, sentiment, contradiction detection, and concise thesis summaries.
- Source reliability exists as a static score, but bias risk, data freshness, ingestion mode, and fallback status are not first-class enough for benchmark-grade evidence scoring.
- Market intelligence can show research-backed signals, but it does not yet expose a durable evidence trail across broader configured sources.

## Target Architecture

```text
Broad Source Ingestion
    -> Content Cleaning & Normalization
    -> Financial Entity Extraction
    -> Signal Extraction
    -> Signal Scoring
    -> Contradiction Detection
    -> Evidence Graph Storage
    -> Market Intelligence
    -> Recommendation Evidence Links
```

Later phases will add market regime, fundamental and technical analysis, optimization, and backtesting. Phase 7A only builds the evidence and source expansion layer.

## Source Expansion Plan

Source registry v2 will be controlled by `backend/app/config/source_registry.yaml`.

Each source includes:

- source identity and type
- RSS/API URL when available
- allowed ingestion method
- API key requirement
- reliability and bias-risk score
- refresh frequency
- market and asset coverage
- country and language
- fallback availability

Ingestion rules:

- Prefer official APIs, RSS feeds, and public structured endpoints.
- Do not bypass paywalls, robots restrictions, logins, or anti-bot controls.
- Do not use uncontrolled browser automation for research ingestion.
- If a source fails, mark it as failed/cached/limited instead of presenting fake live data.
- Cache retrieved content and preserve timestamps.

## Evidence Graph Design

New evidence tables:

- `evidence_items`: normalized source-backed evidence.
- `signal_evidence_links`: links market signals to evidence.
- `recommendation_evidence_links`: links recommendations to evidence.
- `asset_signal_links`: links assets and instruments to market signals.
- `source_reliability_scores`: stores reliability, bias risk, freshness, and mode metadata.

Evidence records store source name, URL, summary, signal type, credibility, relevance, recency, confidence contribution, data mode, and retrieval timestamp.

## Scoring Methodology

Phase 7A scoring is deterministic and transparent:

- credibility score from registry reliability and source health
- recency score from publish/retrieval age
- relevance score from extracted entities, asset classes, sectors, and macro themes
- confidence contribution from credibility, relevance, recency, and sentiment clarity
- source reliability adjusted down for high bias risk, stale data, failed fetches, or fallback mode

Later phases will combine evidence scoring with fundamental, technical, macro, sentiment, portfolio, and backtest scores.

## Data Model Changes

Phase 7A adds new tables only; existing tables remain compatible.

- No existing table is dropped.
- Existing recommendation rows remain valid.
- Recommendation source rows continue to work.
- Evidence links are additive and can be backfilled from future recommendation generations.

## Agent Responsibilities

### WebResearchAgent

- Reads the controlled v2 source registry.
- Ingests only allowed RSS/API/public feed sources.
- Normalizes articles.
- Runs deterministic NLP.
- Produces articles, market signals, source health, and evidence items.

### FinancialEntityExtractor

- Extracts companies, tickers, sectors, asset classes, crypto assets, commodities, macro events, policy events, and geopolitical events.

### SignalExtractor

- Converts normalized article text into structured market signals with affected assets/sectors, opportunities, risks, and confidence.

### SentimentAnalyzer

- Produces bullish, bearish, neutral, or mixed sentiment using finance-specific keyword scoring.

### ContradictionDetector

- Flags conflicting bullish/bearish evidence across the same sector, instrument, or macro theme.

### ThesisSummarizer

- Produces concise user-facing evidence summaries without implying certainty.

### EvidenceGraphService

- Stores evidence.
- Links evidence to market signals.
- Links evidence to recommendation records.
- Links assets/instruments to signals.
- Stores source reliability snapshots.

## Phased Implementation Plan

### Phase 7A: Evidence and Source Expansion

- Add source registry v2.
- Add web research agent.
- Add source reliability scoring.
- Add deterministic financial NLP services.
- Add evidence graph tables and service.
- Link market signals and recommendations to evidence.
- Keep fallback and limited data clearly labelled.

### Phase 7B: Market Intelligence Upgrade

- Macro, policy, and geopolitical interpretation.
- Market regime classification.
- Signal dashboard filters and relevance ranking.

### Phase 7C: Stock and Crypto Intelligence

- Fundamental analysis.
- Technical analysis.
- Crypto narrative analysis.
- Alpha and underdog discovery.

### Phase 7D: Backtesting and Validation

- Lightweight backtesting.
- Strategy validation metrics.
- Model performance tracking.

### Phase 7E: Portfolio Optimization

- Risk-aware and goal-aware allocation.
- Concentration limits.
- Rebalancing thresholds.

### Phase 7F: Recommendation Scoring and UI

- Multi-score recommendation engine.
- Recommendation mix engine.
- Concise evidence-backed UI.

## Risks and Limitations

- RSS and API availability can change without notice.
- Public free data can be delayed, incomplete, or rate-limited.
- Evidence does not guarantee future returns.
- Deterministic NLP can miss nuance; later LLM-assisted extraction should remain evidence-bound and auditable.
- Backtests and historical indicators must be treated as one input, not a prediction guarantee.
- High-risk or limited-data ideas should be downgraded to watchlist or excluded.

## Phase 7A Scope Boundary

Implemented now:

- source registry v2
- controlled web research agent
- source reliability scoring
- financial entity extraction
- signal extraction
- sentiment and contradiction helpers
- evidence graph tables and links
- additive market intelligence evidence plumbing

Deferred:

- portfolio optimization
- backtesting execution
- fundamental/technical analysis engines
- crypto intelligence engine
- alpha discovery engine expansion
- recommendation mix overhaul
