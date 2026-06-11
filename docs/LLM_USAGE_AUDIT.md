# LLM Usage Audit

Date: 2026-05-27

## 1. Current AI Provider

No runtime LLM provider is currently wired into the app.

The codebase contains an `openai_api_key` setting and production-readiness checks for `OPENAI_API_KEY`, but no backend path currently calls OpenAI, Anthropic, Gemini, Ollama, LiteLLM, LangChain, or another LLM client.

## 2. Current Model Name

No active model name is configured or used for inference.

New runtime introspection defaults report:

- Provider: `none`
- Model: `not_configured`
- AI mode: `mock` when no LLM config/key exists, or `fallback` if LLM-like config/key exists but no LLM client is wired

## 3. Where Model Is Configured

Current configuration file:

- `backend/app/core/config.py`

Relevant settings:

- `openai_api_key`
- `llm_provider`
- `llm_model`

The previous app state had `openai_api_key` only. There was no `OPENAI_MODEL`, `MODEL_NAME`, or `LLM_PROVIDER` runtime configuration in use.

No `backend/.env.example` file exists in this checkout.

## 4. Files That Call LLMs

No files were found calling an LLM API.

Search terms checked:

- `OPENAI`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `MODEL_NAME`
- `LLM_PROVIDER`
- `gpt-`
- `chat.completions`
- `responses.create`
- `anthropic`
- `claude`
- `gemini`
- `ollama`
- `litellm`
- `langchain`

Matches found:

- `backend/app/core/config.py`: stores `openai_api_key`, `llm_provider`, and `llm_model`
- `backend/app/services/production/readiness.py`: checks whether `OPENAI_API_KEY` exists as an optional environment key
- `docs/ADVANCED_RESEARCH_ARCHITECTURE.md`: mentions future LLM-assisted extraction using `OPENAI_API_KEY`

None of these call an LLM.

## 5. Agents Using LLMs

No agent currently uses a live LLM.

Important deterministic agents reviewed:

- `backend/app/agents/conversational_financial_agent.py`
- `backend/app/agents/chat_context_assembler_agent.py`
- `backend/app/agents/recommendation_action_agent.py`
- `backend/app/agents/recommendation_orchestrator_agent.py`
- `backend/app/agents/final_recommendation_orchestrator.py`
- `backend/app/agents/recommendation_fusion_agent.py`
- `backend/app/agents/explainability_agent.py`
- `backend/app/agents/evidence_summarization_agent.py`
- `backend/app/agents/asset_intelligence_copy_agent.py`
- `backend/app/agents/web_research_agent.py`

These agents perform rule-based synthesis, scoring, filtering, ranking, summarization, and templated explanation generation.

## 6. Features Using Mock, Template, or Fallback Logic

Template/rule-based response generation:

- `backend/app/agents/conversational_financial_agent.py`
- `backend/app/agents/financial_assistant.py`
- `backend/app/agents/explainability_agent.py`
- `backend/app/agents/evidence_summarization_agent.py`
- `backend/app/agents/asset_intelligence_copy_agent.py`
- `backend/app/services/document_intelligence.py`
- `backend/app/services/nlp/*`

Fallback data paths:

- `backend/app/services/research/market_data_service.py`
- `backend/app/services/research/crypto_research_service.py`
- `backend/app/services/research/fund_research_service.py`
- `backend/app/agents/market_data_agent.py`
- `backend/app/agents/macro_intelligence_agent.py`
- `backend/app/agents/research_intelligence_agent.py`

Frontend fallback presentation:

- `frontend/app/recommendations/page.tsx` uses `fallbackExplanationCards(rec)` if backend explanation cards are absent.
- `frontend/app/market/page.tsx` uses `fallbackEvidence(signal)` if no evidence is provided.

## 7. AI Chat Implementation Status

AI chat does not use a live LLM.

Route:

- `backend/app/api/routes/chat.py`

Flow:

1. Load or accept an onboarding profile.
2. Build context through `backend/app/services/chat/context_builder_service.py`.
3. Assemble derived context through `backend/app/agents/chat_context_assembler_agent.py`.
4. Generate a reply through `backend/app/agents/conversational_financial_agent.py`.
5. Save the chat message through `backend/app/services/chat/chat_memory_service.py`.

The answer generator is deterministic keyword branching. It uses portfolio, market, goals, recommendations, and memory context, but it does not call an LLM.

## 8. Recommendation Generation Implementation Status

Recommendations are rule-based and multi-agent orchestrated. They do not use an LLM.

Main route:

- `backend/app/api/routes/recommendations.py`

Main flow:

- `generate_advanced_recommendations`
- `generate_final_recommendations`
- `generate_institutional_recommendations`
- fusion, consensus, prioritization, explainability, versioning, persistence

Important files:

- `backend/app/agents/recommendation_action_agent.py`
- `backend/app/agents/final_recommendation_orchestrator.py`
- `backend/app/agents/recommendation_orchestrator_agent.py`
- `backend/app/agents/recommendation_fusion_agent.py`
- `backend/app/agents/recommendation_consensus_agent.py`
- `backend/app/agents/recommendation_priority_engine.py`
- `backend/app/agents/master_orchestrator_agent.py`
- `backend/app/services/recommendations/recommendation_builder.py`

The pipeline uses structured data, scoring formulas, quality gates, asset screening, market signals, validation, portfolio optimization, and deterministic explanation generation.

## 9. Market Intelligence Summarization Status

Market intelligence summarization is rule-based.

Important files:

- `backend/app/services/market/signal_intelligence_service.py`
- `backend/app/agents/signal_impact_agent.py`
- `backend/app/agents/market_regime_agent.py`
- `backend/app/agents/sector_rotation_agent.py`
- `backend/app/agents/macro_event_interpreter_agent.py`
- `backend/app/agents/geopolitical_interpreter_agent.py`
- `backend/app/agents/policy_impact_agent.py`
- `backend/app/agents/explainability_agent.py`

Signals are classified through keyword/entity matching, impact maps, source/evidence tables, and deterministic clean headline logic. No LLM summarizer is active.

## 10. Asset Intelligence Summarization Status

Asset intelligence summarization is rule-based and template-driven.

Important files:

- `backend/app/api/routes/assets.py`
- `backend/app/services/assets/asset_intelligence_service.py`
- `backend/app/services/assets/asset_insight_validation_service.py`
- `backend/app/services/evidence/evidence_relevance_service.py`
- `backend/app/agents/asset_intelligence_copy_agent.py`
- `backend/app/agents/fundamental_analysis_agent.py`
- `backend/app/agents/technical_analysis_agent.py`
- `backend/app/agents/alpha_discovery_agent.py`
- `backend/app/agents/crypto_intelligence_agent.py`

Copy is generated from asset class, sector/theme, technical data, fundamental data, liquidity/risk data, and filtered evidence. No live LLM is used.

## 11. Risks And Problems Found

- The app is branded heavily around AI, but there is no live LLM inference path today.
- `OPENAI_API_KEY` is checked in readiness and stored in settings, but unused by runtime AI features.
- There was no explicit provider/model introspection before this audit.
- AI chat can feel canned because it uses deterministic keyword branching.
- Recommendation and explanation quality depends on handcrafted rule coverage, data quality, and fallback paths.
- Frontend fallback explanation cards can mask missing backend explanation fields.
- Several research services intentionally fall back to labelled fallback data when live sources fail; this is safe only if the UI keeps showing data mode clearly.
- `docs/ADVANCED_RESEARCH_ARCHITECTURE.md` describes future LLM-assisted extraction, which can be confused with current runtime behavior.

## 12. Recommended Next Steps

1. Decide whether chat and explanation generation should remain deterministic or use a live LLM behind a feature flag.
2. If live LLMs are introduced, create one central LLM client service instead of agent-local API calls.
3. Add explicit settings for provider, model, timeout, max tokens, retry policy, and feature flags.
4. Keep deterministic fallbacks for chat, recommendations, market summaries, and asset summaries.
5. Add observability for every model call: feature name, provider, model, latency, success/failure, fallback reason, and token usage.
6. Add tests proving that no secrets are logged or returned from debug endpoints.
7. Add tests proving AI chat uses live LLM only when the feature flag and API key are configured.

## Runtime Debugging Added

Endpoint:

- `GET /debug/llm-usage`

Availability:

- Enabled only for local/dev/test environments.
- Returns `404` outside local/dev/test.

Returned fields:

- Configured provider
- Configured model
- AI mode
- Enabled AI features
- Fallback/mock mode status
- Whether an API key is configured

The endpoint does not return API key values.

Startup log added:

```text
LLM provider: <provider>
LLM model: <model>
AI mode: live/mock/fallback
```

No application recommendation, chat, market, or asset-intelligence logic was changed by this audit.
