from __future__ import annotations


def assign_investor_cluster(factors: dict) -> dict:
    risk_score = factors.get("riskCapacityScore", 40)
    liquidity_need_score = factors.get("liquidityNeedScore", 50)
    volatility_score = factors.get("volatilityToleranceScore", 40)
    experience = factors.get("investmentExperienceScore", 50)

    if risk_score >= 78 and volatility_score >= 70 and liquidity_need_score < 55:
        cluster_id = "VA_TAC_GROWTH"
        name = "Very aggressive tactical growth investor"
        risk_profile = "very_aggressive"
        style = "tactical"
        risk_budget, tactical_cap, crypto_cap, small_mid_cap = 82, 22, 10, 10
    elif risk_score >= 62 and liquidity_need_score < 70:
        cluster_id = "AG_GROWTH"
        name = "Aggressive growth investor"
        risk_profile = "aggressive"
        style = "growth"
        risk_budget, tactical_cap, crypto_cap, small_mid_cap = 68, 16, 7, 8
    elif risk_score >= 45:
        cluster_id = "MOD_BALANCED"
        name = "Moderate balanced investor"
        risk_profile = "moderate"
        style = "balanced"
        risk_budget, tactical_cap, crypto_cap, small_mid_cap = 52, 10, 3, 4
    else:
        cluster_id = "CON_GOAL_FIRST"
        name = "Conservative goal-first investor"
        risk_profile = "conservative"
        style = "goal_first"
        risk_budget, tactical_cap, crypto_cap, small_mid_cap = 32, 4, 0, 0

    if liquidity_need_score >= 70:
        style = "goal_first"
        tactical_cap = min(tactical_cap, 5)
        crypto_cap = 0
        small_mid_cap = min(small_mid_cap, 2)

    return {
        "clusterId": cluster_id,
        "clusterName": name,
        "riskProfile": risk_profile,
        "investmentStyle": style,
        "liquidityNeed": "high" if liquidity_need_score >= 70 else "medium" if liquidity_need_score >= 40 else "low",
        "volatilityTolerance": "high" if volatility_score >= 70 else "medium" if volatility_score >= 45 else "low",
        "recommendedRiskBudget": risk_budget,
        "tacticalAllocationCap": tactical_cap,
        "cryptoAllocationCap": crypto_cap,
        "smallMidCapAllocationCap": small_mid_cap,
        "experienceScore": experience,
    }
