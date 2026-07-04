from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Investment Manager"
    environment: str = "development"
    database_url: str = "sqlite:///./ai_investment_manager.db"
    jwt_secret: str = "prototype-secret-change-me"
    jwt_algorithm: str = "HS256"
    # Derives the guest/server data-at-rest key (core/data_encryption); falls
    # back to jwt_secret when unset. Rotating it is safe only for secrets
    # listed in data_encryption._LEGACY_GUEST_SECRETS (startup rekeys them).
    data_encryption_secret: str | None = None
    # Wraps the escrow copy of each user's data key so password reset keeps
    # their financial data. Losing this secret means reset = data loss again.
    recovery_master_key: str | None = None
    access_token_expire_minutes: int = 60 * 24
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:3003",
        "http://127.0.0.1:3003",
        "http://localhost:3004",
        "http://127.0.0.1:3004",
        "http://localhost:3005",
        "http://127.0.0.1:3005",
        "http://localhost:3006",
        "http://127.0.0.1:3006",
        "http://localhost:3007",
        "http://127.0.0.1:3007",
        "http://localhost:3008",
        "http://127.0.0.1:3008",
    ]
    redis_url: str = "redis://localhost:6379/0"
    upload_dir: str = "uploaded_documents"
    max_upload_mb: int = 10
    alpha_vantage_api_key: str | None = None
    twelve_data_api_key: str | None = None
    news_api_key: str | None = None
    coingecko_api_key: str | None = None
    openai_api_key: str | None = None
    resend_api_key: str | None = None
    resend_from_email: str = "AskPapa <onboarding@resend.dev>"
    resend_from_name: str = "AskPapa"
    app_url: str = "http://localhost:3000"
    llm_provider: str = "ollama"
    llm_enabled: bool = True
    llm_model: str = "qwen3:8b"
    ollama_base_url: str = "http://localhost:11434"
    # Set for Ollama Cloud (ollama_base_url=https://ollama.com): sent as a
    # Bearer token, and makes the router trust the configured model names
    # instead of resolving them against the local /api/tags list.
    ollama_api_key: str | None = None
    # Defaults target qwen3:8b (commonly pulled here). The runtime resolves any
    # configured model that isn't actually installed to one that is (see
    # model_router._resolve_model), so a config/.env drift degrades to a working
    # model instead of always falling back to the deterministic baseline.
    llm_model_reasoning: str = "qwen3:8b"
    llm_model_fast: str = "qwen3:8b"
    llm_model_extraction: str = "qwen3:8b"
    llm_model_summarize: str = "qwen3:8b"
    llm_timeout_seconds: int = 25
    llm_timeout_chat_seconds: int = 25
    llm_timeout_enhancement_seconds: int = 30
    llm_timeout_summarize_seconds: int = 8
    llm_retries: int = 1
    llm_batch_size: int = 2
    llm_batch_recommendation_limit: int = 20
    llm_batch_market_limit: int = 20
    llm_batch_asset_limit: int = 40

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
