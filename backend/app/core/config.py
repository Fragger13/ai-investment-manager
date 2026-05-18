from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Investment Manager"
    environment: str = "development"
    database_url: str = "sqlite:///./ai_investment_manager.db"
    jwt_secret: str = "prototype-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    redis_url: str = "redis://localhost:6379/0"
    upload_dir: str = "uploaded_documents"
    max_upload_mb: int = 10
    alpha_vantage_api_key: str | None = None
    twelve_data_api_key: str | None = None
    news_api_key: str | None = None
    coingecko_api_key: str | None = None
    openai_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
