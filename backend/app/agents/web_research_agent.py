from __future__ import annotations

from email.utils import parsedate_to_datetime
from xml.etree import ElementTree

from app.services.intelligence import now_iso
from app.services.nlp.contradiction_detector import detect_contradictions
from app.services.nlp.signal_extractor import extract_signal_from_article
from app.services.research.http_client import fetch_text
from app.services.research.source_registry_v2 import SourceDefinitionV2, source_registry_v2
from app.services.research.source_reliability_service import score_source_reliability


def collect_web_research(limit_per_source: int = 8, source_limit: int = 10) -> dict:
    articles: list[dict] = []
    signals: list[dict] = []
    reliability_scores: list[dict] = []
    source_health: list[dict] = []

    rss_sources = [source for source in source_registry_v2() if source.can_fetch_rss][:source_limit]
    for source in rss_sources:
        items, mode, message = _fetch_source(source, limit_per_source)
        reliability = score_source_reliability(source, mode, len(items), message)
        reliability_scores.append(reliability)
        source_health.append(
            {
                "sourceName": source.source_name,
                "mode": mode,
                "message": message,
                "itemsProcessed": len(items),
                "finalReliabilityScore": reliability["finalReliabilityScore"],
            }
        )
        articles.extend(items)

    for article in articles:
        signal = extract_signal_from_article(article)
        if article.get("sourceReliabilityScore"):
            signal["credibilityScore"] = article["sourceReliabilityScore"]
            signal["confidenceScore"] = max(20, min(95, round((signal["confidenceScore"] + article["sourceReliabilityScore"]) / 2)))
        signals.append(signal)

    contradictions = detect_contradictions(signals)
    if contradictions:
        for signal in signals:
            keys = set(signal.get("sectors", [])) | set(signal.get("instruments", [])) | set(signal.get("macroThemes", []))
            if any(item["entity"] in keys for item in contradictions):
                signal.setdefault("riskSignals", []).append("conflicting source evidence")
                signal["confidenceScore"] = max(20, signal.get("confidenceScore", 50) - 8)

    return {
        "articles": articles,
        "signals": signals,
        "sourceHealth": source_health,
        "reliabilityScores": reliability_scores,
        "contradictions": contradictions,
    }


def _fetch_source(source: SourceDefinitionV2, limit: int) -> tuple[list[dict], str, str]:
    if not source.rss_url:
        return [], "limited", "No RSS URL configured for controlled ingestion."
    result = fetch_text(source.rss_url, retries=2, cache_ttl_seconds=4 * 3600, require_xml=True)
    if not result.ok:
        return [], result.mode, f"RSS fetch failed: {result.message}"
    try:
        root = ElementTree.fromstring(result.text.encode("utf-8"))
    except ElementTree.ParseError as exc:
        return [], "limited", f"RSS XML parse failed: {exc}"
    items = _rss_items(root)
    articles = [_article_from_item(source, item, result.mode) for item in items[:limit]]
    return articles, result.mode, f"Fetched {len(articles)} RSS items from {source.rss_url} ({result.mode})."


def _rss_items(root: ElementTree.Element) -> list[ElementTree.Element]:
    channel_items = root.findall("./channel/item")
    if channel_items:
        return channel_items
    return root.findall("{http://www.w3.org/2005/Atom}entry")


def _article_from_item(source: SourceDefinitionV2, item: ElementTree.Element, mode: str) -> dict:
    title = _text(item, "title")
    summary = _text(item, "description") or _text(item, "summary") or _text(item, "{http://www.w3.org/2005/Atom}summary")
    link = _text(item, "link")
    if not link:
        atom_link = item.find("{http://www.w3.org/2005/Atom}link")
        link = atom_link.attrib.get("href", "") if atom_link is not None else ""
    published = _text(item, "pubDate") or _text(item, "published") or _text(item, "{http://www.w3.org/2005/Atom}updated")
    retrieved_at = now_iso()
    try:
        published_at = parsedate_to_datetime(published).isoformat() if published else ""
    except (TypeError, ValueError):
        published_at = published
    reliability = max(5, min(100, source.reliability_score - round(source.bias_risk_score * 0.25)))
    return {
        "title": _clean(title),
        "summary": _clean(summary),
        "rawText": "",
        "sourceName": source.source_name,
        "sourceUrl": link or f"{source.base_url}#{title}",
        "publishedAt": published_at,
        "retrievedAt": retrieved_at,
        "credibilityScore": reliability,
        "sourceReliabilityScore": reliability,
        "extractionMode": mode,
        "dataMode": mode,
    }


def _text(item: ElementTree.Element, tag: str) -> str:
    node = item.find(tag)
    if node is None:
        node = item.find(f"{{http://www.w3.org/2005/Atom}}{tag}")
    return node.text or "" if node is not None else ""


def _clean(value: str) -> str:
    import re

    without_tags = re.sub(r"<[^>]+>", " ", value or "")
    return " ".join(without_tags.split())
