from __future__ import annotations


def top_rebalancing_actions(optimization: dict) -> list[dict]:
    return optimization.get("rebalancingSuggestions", [])[:5]
