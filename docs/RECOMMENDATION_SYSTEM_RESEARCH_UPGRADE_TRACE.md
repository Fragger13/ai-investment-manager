# Recommendation System Research Upgrade Trace

## Current Runtime Flow

Frontend `frontend/app/recommendations/page.tsx` calls `api.generateAdvancedRecommendations`, which posts to `POST /api/v1/recommendations/generate-advanced`.

Backend route `backend/app/api/routes/recommendations.py` optionally refreshes research, loads the latest onboarding profile, then calls `generate_advanced_recommendations` in `backend/app/agents/recommendation_action_agent.py`.

`recommendation_action_agent.py` delegates to `generate_institutional_recommendations` in `backend/app/agents/recommendation_orchestrator_agent.py`.

The orchestrator currently:
- builds profile context and goals,
- screens research assets and market signals,
- assesses market regime,
- adds alpha candidates,
- interprets macro/geopolitical/sector signals,
- builds portfolio construction,
- sizes positions,
- creates base recommendations,
- enriches recommendations with timing, tactical, conviction, expected return, and risk fields,
- saves results as JSON in `recommendations.recommendation_data`.

## Missing Integrations Before This Upgrade

- Candidate selection was implicit inside asset screening and alpha discovery, not a separate broad candidate stage.
- Profile clustering and factor analysis were not explicit, so caps were not clearly tied to investor segments.
- Evidence scoring was embedded in confidence calculations instead of a reusable evidence layer.
- Re-ranking was a simple sort by goal priority and risk-adjusted score, not a clear multi-factor final scoring stage.
- Knowledge graph relationships were not represented, so second-order beneficiaries and explanation links were implicit.
- Market intelligence headline cleaning and classification lived inside the route instead of a reusable engine.
- Backtesting and validation services were not present.
- Model version metadata was not included in each recommendation.

## Primitive / Fallback Paths

- If no profile exists, the backend uses an empty `OnboardingProfile`.
- If research data is missing or source fetches fail, the app uses limited/cached/fallback-labelled data rather than pretending data is live.
- Static candidate lists exist for core stocks, ETFs, liquid funds, gold, and crypto. These are labelled limited and require live verification.

## Filtering Logic

- Recommendations are suppressed when suitability is below threshold, suggested allocation is zero, or monthly amount is zero.
- Asset-key caps limit debt, equity, gold, crypto, tactical, and other assets.
- High-risk ideas may be downgraded to watchlist if evidence is insufficient or user profile does not support the risk.

## Upgrade Direction

The upgraded pipeline is:

```text
Profile + Goals
  -> FactorAnalysisAgent
  -> InvestorProfileClusteringAgent
  -> MarketRegimeAgent
  -> Macro / Geopolitical / Sector / Sentiment Agents
  -> AssetUniverse + CandidateSelectionAgent
  -> Fundamental + Technical + Crypto Narrative Analysis
  -> EvidenceScoringAgent
  -> Risk / Portfolio / Position Sizing
  -> RecommendationReRankingAgent
  -> Final Recommendation Builder
  -> Backtesting / Model Validation Metadata
```

The goal is evidence-backed decision support, not prediction certainty.
