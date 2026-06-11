# LLM Explainability Path Trace

## Recommendations

- Frontend page: `frontend/app/recommendations/page.tsx`.
- Primary API endpoint: `POST /api/v1/recommendations/generate-advanced`.
- Latest API endpoint: `GET /api/v1/recommendations/latest`.
- Backend route: `backend/app/api/routes/recommendations.py`.
- Recommendation generation entrypoint: `backend/app/agents/recommendation_action_agent.py`.
- Final orchestration path: `backend/app/agents/final_recommendation_orchestrator.py` and `backend/app/agents/recommendation_orchestrator_agent.py`.
- Explainability agent: `backend/app/agents/explainability_agent.py`.
- Current issue found: recommendation generation and latest-refresh paths explicitly call `_ensure_explainability(..., llm_enhance=False)`, and `recommendation_orchestrator_agent.py` calls `enrich_recommendation_explainability(..., llm_enhance=False)`. This makes recommendation explanation cards deterministic even when Ollama is live.
- Frontend fallback: `fallbackExplanationCards(rec)` exists and is used only when `rec.explanationCards` is missing. The frontend does not currently prefer snake_case `explanation_cards`, nor does it render `advanced_analysis` or `full_research_summary`.
- Result: backend LLM output is usually missing for recommendations, and frontend falls back to deterministic content when backend cards are absent.

## Market Intelligence

- Frontend page: `frontend/app/market/page.tsx`.
- Market list endpoint: `GET /api/v1/market/signals`.
- Market detail endpoint: `GET /api/v1/market/signals/{id}`.
- Backend route: `backend/app/api/routes/market.py`.
- Signal assembly service: `backend/app/services/market/signal_intelligence_service.py`.
- Market copy agent: `backend/app/agents/market_signal_copy_agent.py`.
- Explainability agent: `backend/app/agents/explainability_agent.py`, function `build_market_signal_explainability`.
- Current issue found: `market_signal_list()` calls `_enriched_signal(..., llm_enhance=False)`, so list cards use deterministic headlines. Only detail generation attempts copy enrichment.
- Frontend fallback: `fallbackEvidence(signal)` exists and is only used if backend evidence is missing. The frontend uses `signal.cleanSummary`, `signal.whyItMatters`, and `signal.explainability`, but it does not prefer LLM-specific fields like `clean_headline`, `why_it_matters`, or `user_relevance`.
- Result: market cards are mostly deterministic; detail copy can be enriched only when the detail endpoint is called and the LLM returns before timeout.

## Asset Intelligence

- Frontend page: `frontend/app/asset-intelligence/page.tsx`.
- Asset list endpoint: `GET /api/v1/assets/research`.
- Asset detail endpoint: `GET /api/v1/assets/{symbol}/research`.
- Backend route: `backend/app/api/routes/assets.py`.
- Asset research service: `backend/app/services/assets/asset_intelligence_service.py`.
- Validation service: `backend/app/services/assets/asset_insight_validation_service.py`.
- Copy agent: `backend/app/agents/asset_intelligence_copy_agent.py`.
- Current issue found: `asset_research()` calls `validate_asset_insight(..., llm_enhance=False)` for list output. The frontend builds modal content from list data, so users see deterministic asset summaries even though detail can use LLM.
- Frontend rendering: `mapAssetOpportunity()` uses `asset.summary`, `asset.whyThisMatters`, `asset.whyNow`, `asset.supportingEvidence`, `asset.risks`, and `asset.dataPoints`. It does not fetch detail copy on modal open and does not read snake_case LLM fields.
- Result: asset intelligence list and modal currently show deterministic analyst templates unless a specific backend detail endpoint is called separately.

## Required Fix

- Keep core data deterministic and never dependent on LLM success.
- Add metadata to every LLM-enhanced payload: `llm_enhanced`, `llm_provider`, `llm_model`, `llm_generated_at`, and `llm_fallback_reason`.
- Add explicit refresh endpoints for recommendation, market, and asset copy so Qwen enhancement can be tested without regenerating core recommendations.
- Make frontend prefer backend LLM fields when present and use deterministic fallback only when backend fields are missing.

## Implemented Wiring Notes

- Recommendation generation now enhances the first visible recommendation through the central `model_router`, while all recommendations retain deterministic fallback explainability.
- Recommendation refresh is available through `POST /api/v1/recommendations/{recommendation_id}/refresh-explanation`.
- Market signal lists enhance the first visible signal copy through `market_signal_copy_agent`; detail and refresh endpoints force enhanced copy when available.
- Market copy refresh is available through `POST /api/v1/market/signals/{signal_id}/refresh-copy`.
- Asset intelligence lists enhance the first visible asset copy through `asset_intelligence_copy_agent`; detail and refresh endpoints force enhanced copy when available.
- Asset copy refresh is available through `POST /api/v1/assets/{symbol}/refresh-copy`.
- Frontend pages now prefer backend `explanation_cards`, `clean_headline`, `why_it_matters`, `why_this_matters`, `why_now`, `advanced_analysis`, and `full_research_summary` before deterministic fallbacks.
- LLM metadata is returned with recommendation, market, and asset copy so dev tools can confirm whether Qwen was used or a deterministic fallback was applied.

## Integration Verification Update

- Actual regression source found for recommendations: `POST /api/v1/recommendations/generate-advanced` can return a cached orchestrated payload before `_ensure_explainability()` runs. Cached payloads created before LLM wiring can therefore look template-based even when Ollama is live.
- Secondary recommendation issue found: `AdvancedRecommendationResponse` was filtered through the Pydantic response model, which did not declare `explanation_cards`, `advanced_analysis`, `full_research_summary`, or LLM metadata. Those backend fields could be generated and then stripped before reaching the frontend.
- Market issue found: `GET /api/v1/market/signals` can return cached market cards that predate LLM copy generation. The cache path now regenerates if the cached first signal has no LLM metadata.
- Frontend issue found: recommendation cards still used `conciseReason` / `whyThisMatters` for visible top reason even when backend `explanation_cards` existed. Cards now prioritize the backend answer to “Why is this recommended?” and “What can go wrong?” before older derived fields.
- Dev-only payload traces now log whether the first visible recommendation, market signal, and asset idea include enhanced fields. Dev-only chips show `LLM Enhanced` or fallback status without exposing prompt or financial data.
