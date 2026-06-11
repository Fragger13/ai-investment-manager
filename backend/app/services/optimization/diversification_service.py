from __future__ import annotations

from app.services.optimization.correlation_service import overlap_warnings


def diversification_score(targets: dict[str, int], current: dict[str, int]) -> int:
    active_buckets = sum(1 for value in current.values() if value > 0)
    target_spread = sum(1 for value in targets.values() if value >= 3)
    largest = max(targets.values()) if targets else 100
    score = 28 + active_buckets * 7 + target_spread * 6 - max(0, largest - 45)
    if overlap_warnings(targets):
        score -= 10
    return max(5, min(95, round(score)))


def concentration_score(current_pct: dict[str, int], targets: dict[str, int]) -> int:
    largest_current = max(current_pct.values()) if current_pct else 0
    largest_target = max(targets.values()) if targets else 0
    score = 100 - max(largest_current, largest_target) + min(15, len([v for v in targets.values() if v > 0]) * 2)
    return max(5, min(95, round(score)))


def allocation_drift(current_pct: dict[str, int], targets: dict[str, int]) -> int:
    return round(sum(abs(targets.get(bucket, 0) - current_pct.get(bucket, 0)) for bucket in targets) / 2)

