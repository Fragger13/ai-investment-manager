from __future__ import annotations


def identify_concentration_risks(optimization: dict) -> list[str]:
    warnings = list(optimization.get("riskWarnings", []))
    buckets = optimization.get("bucketAllocations", [])
    for bucket in buckets:
        if bucket.get("currentPercentage", 0) > bucket.get("targetPercentage", 0) + 10:
            warnings.append(f"{bucket.get('bucketName')} is materially above target.")
    return warnings[:8]

