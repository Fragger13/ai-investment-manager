from __future__ import annotations

from datetime import UTC, datetime
import re
from xml.etree import ElementTree


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def extract_rss_items(xml_text: str, source_name: str, credibility_score: int, limit: int = 10) -> list[dict]:
    root = ElementTree.fromstring(xml_text)
    items = []
    nodes = root.findall(".//item")
    if not nodes:
        nodes = root.findall(".//{http://www.w3.org/2005/Atom}entry")
    for item in nodes[:limit]:
        title = item.findtext("title") or item.findtext("{http://www.w3.org/2005/Atom}title") or "Untitled research item"
        link = item.findtext("link") or ""
        if not link:
            link_node = item.find("{http://www.w3.org/2005/Atom}link")
            link = link_node.attrib.get("href", "") if link_node is not None else ""
        summary = item.findtext("description") or item.findtext("summary") or item.findtext("{http://www.w3.org/2005/Atom}summary") or ""
        published = item.findtext("pubDate") or item.findtext("published") or item.findtext("{http://www.w3.org/2005/Atom}published") or ""
        summary = re.sub(r"<[^>]+>", " ", summary)
        summary = re.sub(r"\s+", " ", summary).strip()
        items.append(
            {
                "sourceName": source_name,
                "sourceUrl": link,
                "title": title.strip(),
                "summary": summary.strip(),
                "rawText": "",
                "publishedAt": published,
                "retrievedAt": now_iso(),
                "credibilityScore": credibility_score,
                "extractionMode": "live",
            }
        )
    return items
