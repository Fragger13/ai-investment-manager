from __future__ import annotations


def summarize_thesis(title: str, summary: str, entities: dict, sentiment: dict) -> dict:
    sectors = ", ".join(entities.get("sectors", [])[:3]) or "the market"
    direction = sentiment.get("sentiment", "neutral")
    clean_title = _clean_sentence(title or summary)
    why = f"This may matter for {sectors} because current evidence is {direction} and could affect allocation timing."
    if direction == "mixed":
        why = f"This signal is mixed for {sectors}; it is useful as evidence but should not be used alone."
    return {
        "headline": clean_title,
        "whyItMatters": why,
        "conciseThesis": _clean_sentence(summary or title)[:260],
    }


def _clean_sentence(value: str) -> str:
    cleaned = " ".join((value or "").replace("\n", " ").split())
    if not cleaned:
        return "Source-backed market update"
    return cleaned[:1].upper() + cleaned[1:220]
