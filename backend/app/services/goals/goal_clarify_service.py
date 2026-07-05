"""For a free-form ("Other") goal, ask the LLM for a few clarifying questions
tailored to what the user is saving for — the cost drivers that matter (for a
trip: destination, how many people, how many days, style of stay). More context
means a far more realistic estimate. Falls back to a single budget-range question
when the model is unavailable, which also anchors the estimate."""
from __future__ import annotations

from typing import Any

from app.services.llm.model_router import generate_goal_clarify

# Upper bound on tailored clarifiers. Enough to nail the cost drivers, few enough
# that the "Not sure?" flow still feels quick (a "when do you need it" question is
# appended by the client on top of these).
_MAX_CLARIFY_QUESTIONS = 4

# Fallback when the LLM can't generate tailored questions. It doubles as the
# deterministic estimate anchor (price_range → a number in goal_estimator).
_PRICE_RANGE_FALLBACK: dict[str, Any] = {
    "key": "price_range",
    "prompt": "Roughly what budget range feels right?",
    "options": [
        {"value": "under25k", "label": "Under ₹25k"},
        {"value": "25k-1l", "label": "₹25k to ₹1L"},
        {"value": "1-5l", "label": "₹1L to ₹5L"},
        {"value": "5-15l", "label": "₹5L to ₹15L"},
        {"value": "15l+", "label": "₹15L+"},
    ],
}


def _compact_profile(profile: dict[str, Any] | None) -> dict[str, Any]:
    p = profile or {}
    return {"city": p.get("city"), "occupation": p.get("occupation")}


def _clean_question(q: Any) -> dict[str, Any] | None:
    if not isinstance(q, dict):
        return None
    key = str(q.get("key") or "").strip().lower().replace(" ", "_")[:40]
    prompt = " ".join(str(q.get("prompt") or "").split()).strip()
    if not key or not prompt:
        return None
    raw_options = q.get("options")
    if not isinstance(raw_options, list):
        return None
    options: list[dict[str, str]] = []
    seen: set[str] = set()
    for option in raw_options[:4]:
        if not isinstance(option, dict):
            continue
        value = str(option.get("value") or option.get("label") or "").strip().lower().replace(" ", "_")[:40]
        label = " ".join(str(option.get("label") or option.get("value") or "").split()).strip()[:40]
        if value and label and value not in seen:
            options.append({"value": value, "label": label})
            seen.add(value)
    if len(options) < 2:
        return None
    return {"key": key, "prompt": prompt, "options": options}


def clarify_goal(description: str, profile: dict[str, Any] | None = None) -> dict[str, Any]:
    fallback = {"questions": [_PRICE_RANGE_FALLBACK]}
    desc = str(description or "").strip()
    if not desc:
        return fallback

    try:
        payload, _meta = generate_goal_clarify(desc, _compact_profile(profile), fallback)
    except Exception:  # noqa: BLE001 — never break onboarding
        return fallback

    raw = payload.get("questions") if isinstance(payload, dict) else None
    if not isinstance(raw, list):
        return fallback

    # Keep the valid clarifiers (deduped by key), capped so the flow stays short.
    # A handful is enough to pin the real cost drivers — destination, party size,
    # duration, tier — which is what makes a "Sri Lanka trip" land near ₹1.5L
    # instead of a wild ₹12L guess.
    cleaned: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for question in raw:
        cq = _clean_question(question)
        if cq and cq["key"] not in seen_keys:
            cleaned.append(cq)
            seen_keys.add(cq["key"])
        if len(cleaned) >= _MAX_CLARIFY_QUESTIONS:
            break
    return {"questions": cleaned or [_PRICE_RANGE_FALLBACK]}
