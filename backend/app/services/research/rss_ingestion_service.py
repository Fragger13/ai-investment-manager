from __future__ import annotations

from xml.etree.ElementTree import ParseError

from app.services.research.article_extraction_service import extract_rss_items
from app.services.research.http_client import fetch_text
from app.services.research.source_registry import SourceDefinition


def fetch_rss_source(source: SourceDefinition, timeout: int = 8) -> tuple[list[dict], str, str]:
    endpoint = source.feed_url
    if not endpoint or not source.enabled:
        return [], "limited", "No configured RSS endpoint or source disabled."
    result = fetch_text(endpoint, timeout=timeout, retries=2, cache_ttl_seconds=4 * 3600, require_xml=True)
    if not result.ok:
        return [], result.mode, f"RSS fetch failed: {result.message}"
    try:
        items = extract_rss_items(result.text, source.source_name, source.reliability_score)
    except ParseError:
        return [], "limited", f"RSS endpoint returned non-parseable XML: {endpoint}"
    if not items:
        return [], "limited", f"RSS fetched from {endpoint}, but no feed items were parsed."
    for item in items:
        item["extractionMode"] = result.mode
    return items, result.mode, f"Fetched {len(items)} RSS items from {endpoint} ({result.mode})."


def configured_rss_sources(sources: list[SourceDefinition]) -> list[SourceDefinition]:
    return [source for source in sources if source.source_type == "rss" and source.feed_url and source.enabled]
