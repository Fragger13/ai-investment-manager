# Recommendation Pipeline Trace

## Frontend Entry Point

- Page: `frontend/app/recommendations/page.tsx`
- Function: `load(refreshResearch = false)`
- API client: `frontend/lib/api.ts`
- Endpoint called: `POST /api/v1/recommendations/generate-advanced`
- Payload: `{ profile, refreshResearch }`

The frontend is calling the advanced endpoint, not the older dashboard recommendation endpoint.

## Backend Route

- Route file: `backend/app/api/routes/recommendations.py`
- Route handler: `generate`
- Optional research refresh: `refresh_research(db, force=True)` when requested
- Profile source:
  - Uses request payload profile when provided.
  - Falls back to `_latest_profile(db)` when frontend profile is missing.
- Recommendation entry function: `generate_advanced_recommendations(profile, db)`

## Agent Dispatch

- Dispatch file: `backend/app/agents/recommendation_action_agent.py`
- Active function: `generate_advanced_recommendations`
- Current target: `generate_institutional_recommendations`
- Orchestrator file: `backend/app/agents/recommendation_orchestrator_agent.py`

The Phase 6 orchestrator is connected.

## Agents Currently Executed

The orchestrator currently calls:

- `build_profile_context`
- `build_goal_hierarchy`
- `screen_assets_for_institutional_engine`
- `assess_market_regime`
- `construct_portfolio`
- `signals_for_asset`
- `analyze_asset_fit_with_context`
- `size_position`
- `build_recommendation`
- `build_timing_plan`
- `build_tactical_overlay`
- `score_conviction`

The advanced agents are not fully bypassed, but their output is constrained by old assumptions.

## Suppression Points Found During Trace

1. `recommendation_orchestrator_agent.py` used `used_asset_keys`.
   - This allows only one debt, one equity, one gold, and one crypto recommendation.
   - Result: diversified stock/share/equity opportunities are suppressed.

2. `asset_screening_agent.py` only ranks assets returned by `screen_assets_for_recommendations`.
   - Existing research assets are mostly mutual funds, debt funds, gold ETF, and limited crypto.
   - Result: no direct stock/share candidates and few tactical candidates.

3. `ResearchAsset.asset_key` does not classify individual stocks or tactical ideas.
   - Text containing `stock`, `equity share`, or `share` can become `other`.
   - Result: target allocation and position sizing can become zero.

4. `recommendation_builder.build_recommendation` still performs primitive gating.
   - It calls `analyze_asset_fit_with_context` before Phase 6 position sizing.
   - If old target allocation is zero, tactical/crypto candidates can be discarded before enrichment.

5. Market-regime logic is active but only visible for candidates that survive the older gates.
   - Result: frontend sees market regime fields for only the few surviving robo-advisor-style assets.

6. Frontend renders Phase 6 fields in the expanded detail view, but cards can still look basic when the backend returns only 3 primitive asset classes.

## Required Fix Direction

- Expand the candidate asset universe to include stock/share, ETF, crypto, and tactical opportunity candidates with clear `limited` or `fallback` labels when live data is unavailable.
- Classify stock/share/tactical candidates explicitly.
- Allow multiple recommendations per asset family with sensible caps instead of one per asset key.
- Build Phase 6 recommendations from Phase 6 sizing/fit first, not from primitive builder gates.
- Preserve source attribution and never label fallback/limited candidates as live.

## Integration Fix Applied

- `recommendation_action_agent.py` now dispatches advanced generation to `generate_institutional_recommendations`.
- `recommendation_orchestrator_agent.py` now uses:
  - `MarketRegimeAgent`
  - `AssetScreeningAgent`
  - `GoalAllocationAgent`
  - `PortfolioConstructionAgent`
  - `PositionSizingAgent`
  - `TimingIntelligenceAgent`
  - `TacticalAllocationAgent`
  - `ConvictionScoringAgent`
  - final recommendation assembly
- The one-per-asset-key gate was replaced with caps by family:
  - debt: 2
  - equity: 5
  - gold: 2
  - crypto: 2
  - tactical: 2
- The asset universe now includes limited-labelled direct stock/share candidates, sector tactical ETF candidates, and BTC/ETH candidates.
- `ResearchAsset.asset_key` now classifies stock/share/equity and tactical candidates.
- Phase 6 sizing is passed into the final recommendation builder using `fit_override`.
- Limited/fallback candidate assets remain labelled `limited` or `fallback` even when broader market signals are live.

## Current Runtime Output Shape

The advanced endpoint now returns diversified recommendation objects with:

- `ticker`
- `recommendationType`
- `linkedGoals`
- `marketRegime`
- `portfolioConstruction`
- `positionSizing`
- `buyRange`
- `sellRange`
- `stopLossLogic`
- `rebalanceLogic`
- `convictionScore`
- `concentrationImpact`
- `volatilityWarning`
- `downsideScenario`

The frontend renders these fields on the recommendation card and expanded detail view.
