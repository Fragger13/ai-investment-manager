from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os

import yaml

from app.core.config import settings


@dataclass(frozen=True)
class SourceDefinition:
    source_name: str
    source_type: str
    base_url: str
    reliability_score: int
    allowed_ingestion_method: str
    refresh_frequency: str
    categories_covered: list[str]
    enabled: bool = True
    feed_url: str | None = None

    def to_response(self, data_mode: str = "fallback") -> dict:
        return {
            "sourceName": self.source_name,
            "sourceType": self.source_type,
            "baseUrl": self.base_url,
            "reliabilityScore": self.reliability_score,
            "allowedIngestionMethod": self.allowed_ingestion_method,
            "refreshFrequency": self.refresh_frequency,
            "categoriesCovered": self.categories_covered,
            "enabled": self.enabled,
            "dataMode": data_mode,
        }


def source_registry() -> list[SourceDefinition]:
    config_path = Path(__file__).resolve().parents[2] / "config" / "research_sources.yaml"
    payload = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    sources = []
    for item in payload.get("sources", []):
        enabled = bool(item.get("enabled", True))
        enabled_by_env = item.get("enabled_by_env")
        if enabled_by_env:
            enabled = bool(os.getenv(enabled_by_env, ""))
        sources.append(
            SourceDefinition(
                source_name=item["source_name"],
                source_type=item["source_type"],
                base_url=item["base_url"],
                reliability_score=int(item["reliability_score"]),
                allowed_ingestion_method=item["allowed_ingestion_method"],
                refresh_frequency=item["refresh_frequency"],
                categories_covered=list(item.get("categories_covered", [])),
                enabled=enabled,
                feed_url=item.get("feed_url"),
            )
        )
    return sources


def limited_mode_reason() -> str:
    missing = []
    if not settings.alpha_vantage_api_key:
        missing.append("ALPHA_VANTAGE_API_KEY")
    if not settings.twelve_data_api_key:
        missing.append("TWELVE_DATA_API_KEY")
    if not settings.news_api_key:
        missing.append("NEWS_API_KEY")
    if not settings.coingecko_api_key:
        missing.append("COINGECKO_API_KEY")
    if missing:
        return f"Limited mode: optional keys missing ({', '.join(missing)}). Free public endpoints are used where available; failed sources are clearly labelled."
    return "API keys configured. RSS/API ingestion is enabled without uncontrolled crawling."
