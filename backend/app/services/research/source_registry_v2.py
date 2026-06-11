from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os

import yaml


@dataclass(frozen=True)
class SourceDefinitionV2:
    source_name: str
    source_type: str
    base_url: str
    rss_url: str | None
    api_url: str | None
    ingestion_method: str
    allowed: bool
    requires_api_key: bool
    reliability_score: int
    bias_risk_score: int
    refresh_frequency: str
    market_coverage: list[str]
    asset_coverage: list[str]
    country: str
    language: str
    enabled: bool
    fallback_available: bool

    @property
    def can_fetch_rss(self) -> bool:
        return self.enabled and self.allowed and self.ingestion_method == "rss" and bool(self.rss_url)

    @property
    def source_key(self) -> str:
        return self.source_name.lower().replace(" ", "_")


def source_registry_v2() -> list[SourceDefinitionV2]:
    config_path = Path(__file__).resolve().parents[2] / "config" / "source_registry.yaml"
    payload = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    sources: list[SourceDefinitionV2] = []
    for item in payload.get("sources", []):
        enabled = bool(item.get("enabled", True))
        enabled_by_env = item.get("enabled_by_env")
        if enabled_by_env:
            enabled = bool(os.getenv(str(enabled_by_env), ""))
        sources.append(
            SourceDefinitionV2(
                source_name=item["source_name"],
                source_type=item["source_type"],
                base_url=item["base_url"],
                rss_url=item.get("rss_url"),
                api_url=item.get("api_url"),
                ingestion_method=item["ingestion_method"],
                allowed=bool(item.get("allowed", True)),
                requires_api_key=bool(item.get("requires_api_key", False)),
                reliability_score=int(item.get("reliability_score", 50)),
                bias_risk_score=int(item.get("bias_risk_score", 30)),
                refresh_frequency=item.get("refresh_frequency", "daily"),
                market_coverage=list(item.get("market_coverage", [])),
                asset_coverage=list(item.get("asset_coverage", [])),
                country=item.get("country", "global"),
                language=item.get("language", "en"),
                enabled=enabled,
                fallback_available=bool(item.get("fallback_available", False)),
            )
        )
    return sources


def registry_v2_summary() -> dict:
    sources = source_registry_v2()
    return {
        "sourceCount": len(sources),
        "enabledCount": len([source for source in sources if source.enabled and source.allowed]),
        "rssCount": len([source for source in sources if source.can_fetch_rss]),
        "apiCount": len([source for source in sources if source.source_type == "api"]),
    }
