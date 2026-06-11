from __future__ import annotations

from typing import Any


def audit_recommendation_quality(recommendations: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    seen_assets: set[str] = set()
    audited = []
    issues: list[dict[str, Any]] = []
    crypto_allocation = 0
    tactical_allocation = 0

    for rec in recommendations:
        item = dict(rec)
        warnings = list(item.get("qualityWarnings", []))
        key = _asset_key(item)
        if key in seen_assets:
            warnings.append("duplicate_asset")
            issues.append({"instrumentName": item.get("instrumentName"), "issue": "duplicate_asset"})
        seen_assets.add(key)

        evidence = item.get("evidenceScore", item.get("confidenceScore", 0))
        validation = item.get("validationScore", 0)
        if evidence < 45:
            warnings.append("weak_evidence")
        if item.get("riskLevel") == "High" and evidence < 65:
            warnings.append("high_risk_weak_evidence")
        if item.get("recommendationType") in {"Tactical", "Underdog", "Event-driven", "Speculative"} and validation < 35:
            warnings.append("weak_tactical_validation")
        if item.get("concentrationRiskImpact") == "increases" and not item.get("helpsDiversification"):
            warnings.append("concentration_risk")

        if item.get("strategyBucket") == "Crypto" or item.get("bucket") == "crypto":
            crypto_allocation += item.get("suggestedAllocationPercentage", 0)
        if item.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven"}:
            tactical_allocation += item.get("suggestedAllocationPercentage", 0)

        if _should_watchlist(item, warnings):
            item["action"] = "watchlist"
            item["recommendationState"] = "watchlist"
            item["surfaceGroup"] = "Watchlist"
            item["whyChanged"] = item.get("whyChanged") or "Quality audit moved this to Watchlist because evidence, validation, or risk controls need review."

        item["qualityWarnings"] = sorted(set(warnings))
        item["qualityAudit"] = {
            "passed": not warnings,
            "warnings": item["qualityWarnings"],
            "evidenceScore": evidence,
            "validationScore": validation,
            "auditor": "RecommendationQualityAuditAgent",
        }
        audited.append(item)

    if crypto_allocation > 10:
        issues.append({"issue": "excessive_crypto_exposure", "allocation": crypto_allocation})
    if tactical_allocation > 25:
        issues.append({"issue": "excessive_tactical_exposure", "allocation": tactical_allocation})

    return audited, {
        "issues": issues,
        "duplicateCount": sum(1 for issue in issues if issue.get("issue") == "duplicate_asset"),
        "cryptoAllocation": crypto_allocation,
        "tacticalAllocation": tactical_allocation,
    }


def _asset_key(rec: dict[str, Any]) -> str:
    return "|".join([str(rec.get("instrumentName", "")).lower(), str(rec.get("ticker", "")).lower(), str(rec.get("assetType", "")).lower()])


def _should_watchlist(rec: dict[str, Any], warnings: list[str]) -> bool:
    if "duplicate_asset" in warnings:
        return True
    if "high_risk_weak_evidence" in warnings:
        return True
    if "weak_tactical_validation" in warnings and rec.get("riskLevel") == "High":
        return True
    if rec.get("confidenceScore", 100) < 50:
        return True
    return False
