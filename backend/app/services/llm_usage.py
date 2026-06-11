from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.services.llm.background_enhancement_service import enhancement_queue_status
from app.services.llm.llm_observability import recent_llm_events
from app.services.llm.model_router import ollama_model_available, ollama_reachable


def llm_usage_snapshot() -> dict[str, Any]:
    """Runtime LLM configuration metadata without exposing secrets."""

    provider = (settings.llm_provider or "none").strip() or "none"
    model = _display_model(provider)
    api_key_configured = bool(settings.openai_api_key)
    llm_client_wired = provider.lower() == "ollama"
    reachable = ollama_reachable() if settings.llm_enabled and llm_client_wired else False
    model_available = ollama_model_available(model) if reachable else False
    ai_mode = _ai_mode(provider, model, api_key_configured, llm_client_wired, reachable and model_available)
    return {
        "provider": provider,
        "model": model,
        "ollamaBaseUrl": settings.ollama_base_url if provider.lower() == "ollama" else None,
        "configuredModels": {
            "reasoning": settings.llm_model_reasoning,
            "fast": settings.llm_model_fast,
            "extraction": settings.llm_model_extraction,
        },
        "llmEnabled": settings.llm_enabled,
        "ollamaReachable": reachable,
        "ollamaModelAvailable": model_available,
        "aiMode": ai_mode,
        "apiKeyConfigured": api_key_configured,
        "llmClientWired": llm_client_wired,
        "timeouts": {
            "chatSeconds": settings.llm_timeout_chat_seconds,
            "enhancementSeconds": settings.llm_timeout_enhancement_seconds,
        },
        "backgroundEnhancement": enhancement_queue_status(),
        "fallbackMockMode": {
            "chatUsesLlm": settings.llm_enabled and model_available,
            "recommendationsUseLlm": False,
            "recommendationExplanationCardsUseLlm": settings.llm_enabled and model_available,
            "marketSummariesUseLlm": settings.llm_enabled and model_available,
            "assetSummariesUseLlm": settings.llm_enabled and model_available,
            "documentIntelligenceUsesLlm": False,
            "usesRuleBasedSynthesis": not (settings.llm_enabled and model_available),
            "usesFallbackDataWhenSourcesFail": True,
        },
        "enabledAiFeatures": {
            "chat": "ollama_contextual_response_with_rule_based_fallback" if settings.llm_enabled else "contextual_rule_based_responses",
            "recommendations": "rule_based_multi_agent_orchestration",
            "marketIntelligence": "rule_based_signal_extraction_and_impact_mapping",
            "assetIntelligence": "validated_research_copy_with_optional_ollama_rewrite" if settings.llm_enabled else "rule_based_research_copy_and_validation",
            "documents": "parser_based_financial_extraction",
            "explainability": "optional_ollama_rewrite_with_template_fallback" if settings.llm_enabled else "template_and_signal_based_explanations",
        },
        "recentEvents": recent_llm_events()[-10:],
    }


def is_dev_environment() -> bool:
    return settings.environment.lower() in {"development", "dev", "local", "test"}


def _display_model(provider: str) -> str:
    if provider.lower() == "ollama" or settings.llm_enabled:
        return (settings.llm_model_reasoning or settings.llm_model or "not_configured").strip() or "not_configured"
    return (settings.llm_model or "not_configured").strip() or "not_configured"


def _ai_mode(provider: str, model: str, api_key_configured: bool, llm_client_wired: bool, reachable: bool) -> str:
    if settings.llm_enabled and llm_client_wired and provider != "none" and model != "not_configured" and reachable:
        return "live"
    if settings.llm_enabled or api_key_configured or provider != "none" or model != "not_configured":
        return "fallback"
    return "mock"
