"""Pinpoint specific mutual funds per recommendation category.

Thin wrapper over ``fund_factor_service``: it discovers Direct+Growth candidates
for a category and ranks them. The heavy lifting (NAV history, factor math,
candidate discovery, name cleanup) lives in ``fund_factor_service`` so there is a
single source of truth; this module just exposes a simple ``pick_funds`` ranked
by the factor composite (with a trailing-CAGR fallback) for the lightweight
dashboard cards. The advanced engine uses the factor service directly.
"""

from __future__ import annotations

from app.services.research.fund_factor_service import (
    CATEGORY_SPECS,
    category_candidates,
    category_percentiles,
    score_fund,
)


def pick_funds(category_key: str, limit: int = 3, amfi_text: str | None = None) -> list[dict]:
    """Return up to ``limit`` specific funds for a category, best first.

    Ranks by the (profile-neutral) factor composite so the dashboard already
    reflects risk-adjusted quality rather than trailing return alone; falls back
    to trailing CAGR when factor scoring is unavailable.
    """
    if category_key not in CATEGORY_SPECS:
        return []
    candidates = category_candidates(category_key, amfi_text)
    if not candidates:
        return []
    pcts = category_percentiles(candidates)

    def _rank(fund: dict) -> float:
        scored = score_fund(fund, pcts.get(fund["schemeCode"], {}))
        return scored["score"]

    ranked = sorted(candidates, key=_rank, reverse=True)
    out = []
    for fund in ranked[:limit]:
        long_ret = next((fund.get(k) for k in ("cagr5y", "cagr3y", "cagr1y") if fund.get(k) is not None), None)
        basis = "5Y" if fund.get("cagr5y") is not None else "3Y" if fund.get("cagr3y") is not None else "1Y"
        out.append(
            {
                "name": fund["name"],
                "fundHouse": fund.get("fundHouse", ""),
                "schemeCode": fund["schemeCode"],
                "plan": fund.get("plan", "Direct - Growth"),
                "latestNav": fund.get("latestNav", 0.0),
                "navDate": fund.get("navDate", ""),
                "return1y": fund.get("cagr1y"),
                "return3y": fund.get("cagr3y"),
                "return5y": fund.get("cagr5y"),
                "rankReturn": long_ret,
                "rankBasis": basis,
            }
        )
    return out
