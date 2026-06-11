from __future__ import annotations

import json
from datetime import UTC, datetime
from math import pow

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user_action_event import UserActionEvent
from app.schemas.financial import OnboardingProfile
from app.services.intelligence import allocation, monthly_income, net_worth, total_emi_payments
from app.services.memory.adaptive_memory_service import snapshot_portfolio
from app.services.optimization.portfolio_optimizer import latest_optimization, optimize_portfolio
from app.services.profile_resolution import latest_saved_profile, resolve_profile

router = APIRouter()


def _latest_profile(db: Session) -> OnboardingProfile:
    return latest_saved_profile(db)


@router.get("/optimization")
def optimization(db: Session = Depends(get_db)) -> dict:
    current = latest_optimization(db)
    if current:
        return current
    return optimize_portfolio(db, _latest_profile(db))


@router.post("/optimize")
def optimize(payload: OnboardingProfile | None = None, db: Session = Depends(get_db)) -> dict:
    result = optimize_portfolio(db, resolve_profile(db, payload))
    snapshot_portfolio(db, result)
    return result


@router.get("/allocation-targets")
def allocation_targets(db: Session = Depends(get_db)) -> list[dict]:
    return optimization(db)["targetAllocation"]


@router.get("/risk-analysis")
def risk_analysis(db: Session = Depends(get_db)) -> dict:
    result = optimization(db)
    return {
        "summary": result["summary"],
        "riskMetrics": result["riskMetrics"],
        "riskWarnings": result["riskWarnings"],
        "regimeAdjustments": result["regimeAdjustments"],
    }


@router.get("/rebalancing-suggestions")
def rebalancing_suggestions(db: Session = Depends(get_db)) -> list[dict]:
    return optimization(db)["rebalancingSuggestions"]


@router.post("/summary")
def portfolio_summary(payload: OnboardingProfile | None = None, db: Session = Depends(get_db)) -> dict:
    """Comprehensive user-facing portfolio view.

    Combines static profile-based holdings with the user's recorded actions
    (Add to Plan / Take Action / Add to watchlist) to produce a single view
    that reflects what the user actually has and what they have committed to.
    """
    profile = resolve_profile(db, payload)

    worth = net_worth(profile)
    income = monthly_income(profile)
    emi_total = total_emi_payments(profile)
    surplus = max(income - profile.monthlyExpenses - emi_total, 0)

    # Recent user actions from the backend memory store
    actions = (
        db.query(UserActionEvent)
        .order_by(UserActionEvent.id.desc())
        .limit(200)
        .all()
    )

    parsed_actions: list[dict] = []
    committed_monthly = 0.0
    # Group taken actions by instrument so we can build virtual holdings
    actions_by_key: dict[str, dict] = {}
    now = datetime.now(UTC)
    for row in actions:
        try:
            payload_json = json.loads(row.payload_json) if row.payload_json else {}
        except json.JSONDecodeError:
            payload_json = {}
        try:
            amount = float(payload_json.get("amount") or 0)
        except (TypeError, ValueError):
            amount = 0.0
        action_record = {
            "id": row.id,
            "actionType": row.action_type,
            "entityType": row.entity_type,
            "entityName": row.entity_name,
            "amount": amount,
            "startDate": payload_json.get("startDate", ""),
            "endDate": payload_json.get("endDate", ""),
            "notes": payload_json.get("notes", ""),
            "createdAt": row.created_at or "",
            "category": payload_json.get("category", ""),
        }
        parsed_actions.append(action_record)
        if row.action_type == "took_action" and amount > 0:
            committed_monthly += amount
            key = (row.entity_name or row.entity_type or f"action-{row.id}").lower()
            existing = actions_by_key.get(key)
            months = _months_running(payload_json.get("startDate", ""), now)
            simulated_value = int(round(amount * max(months, 1)))
            if existing:
                existing["monthlyAmount"] += amount
                existing["valueEstimate"] += simulated_value
            else:
                actions_by_key[key] = {
                    "name": row.entity_name or "Action contribution",
                    "category": _category_for_action(row.entity_name or "", payload_json.get("category", "")),
                    "monthlyAmount": amount,
                    "valueEstimate": simulated_value,
                    "since": payload_json.get("startDate", ""),
                }

    profile_holdings = _holdings(profile)
    action_holdings = _action_holdings(actions_by_key)
    holdings = sorted(profile_holdings + action_holdings, key=lambda item: item["value"], reverse=True)

    action_value_total = sum(item["value"] for item in action_holdings)
    augmented_worth = worth + action_value_total
    allocation_items = _allocation_with_actions(profile, action_holdings)
    projection = _projection(augmented_worth, surplus + int(committed_monthly), months=24)

    return {
        "netWorth": augmented_worth,
        "baseNetWorth": worth,
        "actionContributedValue": int(action_value_total),
        "monthlyIncome": income,
        "monthlyExpenses": profile.monthlyExpenses,
        "monthlyCommitments": int(emi_total + profile.rent + profile.subscriptions),
        "investableSurplus": surplus,
        "committedMonthly": int(committed_monthly),
        "holdings": holdings,
        "allocation": allocation_items,
        "projection": projection,
        "recentActions": parsed_actions[:20],
        "insights": _insights(profile, augmented_worth, committed_monthly, surplus),
        "generatedAt": datetime.now(UTC).isoformat(timespec="seconds"),
    }


def _months_running(start_date: str, now: datetime) -> int:
    if not start_date:
        return 1
    try:
        start = datetime.fromisoformat(start_date)
    except ValueError:
        return 1
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    diff = (now - start).days // 30
    return max(1, diff + 1)


def _category_for_action(name: str, hint: str) -> str:
    value = f"{name} {hint}".lower()
    if "emergency" in value or "liquid" in value or "savings" in value:
        return "Cash"
    if "debt" in value or "bond" in value or "fd" in value:
        return "Debt"
    if "gold" in value or "sgb" in value or "silver" in value:
        return "Alternative"
    if "crypto" in value or "bitcoin" in value or "ethereum" in value:
        return "Alternative"
    if "stock" in value or "equity" in value or "share" in value or "ltd" in value:
        return "Equity"
    if "fund" in value or "index" in value or "etf" in value or "nifty" in value or "sip" in value:
        return "Equity"
    return "Other"


def _action_holdings(actions_by_key: dict[str, dict]) -> list[dict]:
    out: list[dict] = []
    for key, entry in actions_by_key.items():
        out.append(
            {
                "id": f"action-{key.replace(' ', '-')[:32]}",
                "name": entry["name"],
                "category": entry["category"],
                "value": int(entry["valueEstimate"]),
                "monthlyContribution": int(entry["monthlyAmount"]),
                "since": entry["since"],
                "source": "action",
            }
        )
    return out


def _allocation_with_actions(profile: OnboardingProfile, action_holdings: list[dict]) -> list[dict]:
    """Return allocation list with action contributions merged in."""
    items = list(allocation(profile))
    extras: dict[str, int] = {}
    palette = {
        "Equity": "#2DB67C",
        "Debt": "#3B82F6",
        "Cash": "#10B981",
        "Alternative": "#F59E0B",
        "Other": "#94A3B8",
    }
    for holding in action_holdings:
        extras[holding["category"]] = extras.get(holding["category"], 0) + holding["value"]
    # Append any categories that don't exist in the profile allocation
    existing_names = {entry["name"] for entry in items}
    for name, value in extras.items():
        if name in existing_names:
            continue
        items.append({"name": name, "value": value, "color": palette.get(name, "#94A3B8")})
    return sorted(items, key=lambda entry: entry.get("value", 0), reverse=True)


_HOLDING_CATEGORY = {
    "stock": "Equity",
    "etf": "Equity",
    "mutualFund": "Equity",
    "crypto": "Alternative",
    "gold": "Alternative",
    "silver": "Alternative",
    "realEstate": "Real Estate",
    "bond": "Debt",
    "nps": "Debt",
    "fd": "Debt",
    "cash": "Cash",
    "epfPpf": "Debt",
    "other": "Other",
}


def _holdings(profile: OnboardingProfile) -> list[dict]:
    items: list[dict] = []
    if profile.holdings:
        for h in profile.holdings:
            if h.currentValue <= 0:
                continue
            items.append(
                {
                    "id": h.id or f"holding-{len(items)}",
                    "name": h.name or "Investment",
                    "category": _HOLDING_CATEGORY.get(h.assetClass, "Other"),
                    "value": int(h.currentValue),
                    "valueAtCost": int(h.valueAtCost or 0),
                    "source": "profile",
                    "monthlyContribution": int(h.sipAmount) if h.hasSip and h.sipAmount else 0,
                }
            )
        # cash + EPF still come from the scalar fields (not itemized)
        if profile.cashBalance > 0:
            items.append({"id": "cash", "name": "Cash & liquid", "category": "Cash", "value": int(profile.cashBalance), "source": "profile"})
        if profile.epfPpfValue > 0:
            items.append({"id": "epf-ppf", "name": "EPF / PPF", "category": "Debt", "value": int(profile.epfPpfValue), "source": "profile"})
        return sorted(items, key=lambda item: item["value"], reverse=True)

    base = [
        ("Direct stocks", "stocks", profile.stocksValue, "equity"),
        ("Mutual funds", "mutual-funds", profile.mutualFundsValue, "equity"),
        ("Crypto", "crypto", profile.cryptoValue, "alternative"),
        ("Gold", "gold", profile.goldValue, "alternative"),
        ("EPF / PPF", "epf-ppf", profile.epfPpfValue, "debt"),
        ("Real estate", "real-estate", profile.realEstateValue, "real_estate"),
        ("Cash & liquid", "cash", profile.cashBalance, "cash"),
    ]
    for name, key, value, asset_class in base:
        if value <= 0:
            continue
        items.append(
            {
                "id": key,
                "name": name,
                "category": asset_class.replace("_", " ").title(),
                "value": int(value),
                "source": "profile",
            }
        )
    for index, additional in enumerate(profile.additionalInvestments or []):
        if additional.value <= 0:
            continue
        items.append(
            {
                "id": f"additional-{index}",
                "name": additional.type or "Other investment",
                "category": "Other",
                "value": int(additional.value),
                "source": "profile",
            }
        )
    return sorted(items, key=lambda item: item["value"], reverse=True)


def _projection(starting_worth: int, monthly_contribution: int, months: int = 24) -> list[dict]:
    out = []
    monthly_rate = 0.10 / 12  # assume 10% blended annual
    value = float(starting_worth)
    for index in range(months + 1):
        out.append({"month": f"Month {index}", "value": int(round(value))})
        value = value * (1 + monthly_rate) + monthly_contribution
    return out


def _insights(profile: OnboardingProfile, worth: int, committed_monthly: float, surplus: int) -> list[dict]:
    items: list[dict] = []
    if committed_monthly > 0:
        items.append(
            {
                "tone": "positive",
                "title": "Active monthly commitments",
                "body": f"You're committing ₹{int(committed_monthly):,} per month across recorded actions.",
            }
        )
    if profile.cashBalance < profile.monthlyExpenses * 3:
        items.append(
            {
                "tone": "warning",
                "title": "Buffer below 3 months",
                "body": "Your cash buffer is below 3 months of expenses. Prioritise emergency fund before adding new risk.",
            }
        )
    if worth > 0 and profile.cryptoValue / max(worth, 1) > 0.10:
        items.append(
            {
                "tone": "warning",
                "title": "High crypto exposure",
                "body": "Crypto is over 10% of your portfolio. Consider trimming if this exceeds your risk comfort.",
            }
        )
    if surplus > 0 and committed_monthly < surplus * 0.4:
        items.append(
            {
                "tone": "info",
                "title": "Room to invest more",
                "body": f"You have around ₹{surplus:,}/month available. Adding actions in the Plan tab routes this surplus to goals.",
            }
        )
    if not items:
        items.append(
            {
                "tone": "info",
                "title": "Portfolio looks balanced",
                "body": "No urgent rebalancing flags. Keep reviewing monthly.",
            }
        )
    return items


# Silence unused import warning for pow (kept for future projection variants)
_ = pow
