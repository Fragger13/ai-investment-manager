"""Deterministic goal-cost estimator.

Given a goal type plus a handful of quick-reply answers (city tier, size, when
it's needed, etc.), produce a ballpark target amount in Indian rupees using
simple cost tables and goal-specific inflation. This is intentionally rough — it
exists so a first-time investor who has no idea what a house or a wedding "should"
cost gets a sensible starting figure they can adjust.

It is also the fallback (and the sanity-bound) for the LLM-refined estimate.
"""
from __future__ import annotations

from typing import Any

# Years used for inflating today's cost to the target year.
_WHEN_YEARS: dict[str, int] = {"lt2": 1, "2-5": 3, "6-10": 8, "gt10": 12}

# City-tier multipliers relative to a metro (Mumbai/Delhi/Bengaluru-ish) baseline.
_CITY_TIER: dict[str, float] = {"metro": 1.0, "tier1": 0.7, "tier2": 0.45, "tier3": 0.3}


def _years(answers: dict[str, Any]) -> int:
    return _WHEN_YEARS.get(str(answers.get("whenYears") or "").strip(), 3)


def _city_mult(answers: dict[str, Any], profile: dict[str, Any] | None, default: str = "tier1") -> float:
    tier = str(answers.get("cityTier") or "").strip()
    if tier in _CITY_TIER:
        return _CITY_TIER[tier]
    return _CITY_TIER.get(default, 0.7)


def _round_nice(value: float) -> int:
    n = max(0, int(round(value)))
    if n >= 10_000_000:
        step = 500_000
    elif n >= 1_000_000:
        step = 100_000
    elif n >= 100_000:
        step = 10_000
    else:
        step = 5_000
    return int(round(n / step) * step)


def _band(amount: int) -> tuple[int, int]:
    return _round_nice(amount * 0.8), _round_nice(amount * 1.25)


def _result(base_today: float, inflation: float, years: int, rationale: str, assumptions: list[str]) -> dict[str, Any]:
    if base_today <= 0:
        base_today = 1_000_000
    inflated = base_today * ((1 + inflation) ** max(0, years))
    amount = _round_nice(inflated)
    low, high = _band(amount)
    return {
        "amount": amount,
        "low": low,
        "high": high,
        "rationale": rationale,
        "assumptions": assumptions,
    }


# ── per-goal cost tables (today's rupees) ───────────────────────────────────

_HOUSE_BHK = {"1bhk": 6_000_000, "2bhk": 12_000_000, "3bhk": 20_000_000, "villa": 35_000_000}
_HOUSE_BHK_LABEL = {"1bhk": "a 1 BHK", "2bhk": "a 2 BHK", "3bhk": "a 3 BHK", "villa": "a villa"}
_CITY_LABEL = {"metro": "a metro city", "tier1": "a tier-1 city", "tier2": "a tier-2 city", "tier3": "a smaller town"}

_CAR_SEGMENT = {"hatchback": 700_000, "sedan": 1_200_000, "suv": 1_800_000, "luxury": 5_000_000}
_CAR_SEGMENT_LABEL = {"hatchback": "a hatchback", "sedan": "a sedan", "suv": "an SUV", "luxury": "a luxury car"}

_EDU_BASE = {
    "school": {"india": 1_500_000, "abroad": 6_000_000},
    "undergrad": {"india": 1_500_000, "abroad": 7_000_000},
    "postgrad": {"india": 1_800_000, "abroad": 6_000_000},
}
_EDU_LEVEL_LABEL = {"school": "school", "undergrad": "an undergraduate degree", "postgrad": "a postgraduate degree"}

_WEDDING_SCALE = {"simple": 800_000, "moderate": 2_000_000, "grand": 5_000_000}
_WEDDING_SCALE_LABEL = {"simple": "a simple wedding", "moderate": "a mid-scale wedding", "grand": "a grand wedding"}

_TRAVEL_PER_PERSON = {"domestic": 30_000, "international": 150_000}
_TRAVEL_TRAVELLERS = {"solo": 1, "couple": 2, "family": 4}

_BUSINESS_SCALE = {"side": 300_000, "small": 1_500_000, "ambitious": 5_000_000}
_BUSINESS_SCALE_LABEL = {"side": "a side hustle", "small": "a small business", "ambitious": "an ambitious venture"}

_OTHER_BALLPARK = {"small": 100_000, "medium": 1_000_000, "large": 3_000_000, "xlarge": 7_500_000}
# Midpoints for the fallback budget-range question (used when the LLM is down).
_OTHER_PRICE_RANGE = {"under25k": 15_000, "25k-1l": 60_000, "1-5l": 300_000, "5-15l": 1_000_000, "15l+": 2_500_000}


def _estimate_house(answers: dict[str, Any], profile: dict[str, Any] | None) -> dict[str, Any]:
    bhk = str(answers.get("bhk") or "2bhk")
    base = _HOUSE_BHK.get(bhk, _HOUSE_BHK["2bhk"]) * _city_mult(answers, profile, "metro")
    if str(answers.get("stage")) == "under_construction":
        base *= 0.9
    years = _years(answers)
    tier = str(answers.get("cityTier") or "metro")
    rationale = (
        f"Roughly what {_HOUSE_BHK_LABEL.get(bhk, 'a home')} costs in "
        f"{_CITY_LABEL.get(tier, 'an Indian city')} today, grown for property inflation."
    )
    assumptions = [
        f"{_HOUSE_BHK_LABEL.get(bhk, 'a home').capitalize()} in {_CITY_LABEL.get(tier, 'an Indian city')}",
        "~6% property inflation a year",
    ]
    return _result(base, 0.06, years, rationale, assumptions)


def _estimate_car(answers: dict[str, Any], profile: dict[str, Any] | None) -> dict[str, Any]:
    seg = str(answers.get("segment") or "hatchback")
    base = _CAR_SEGMENT.get(seg, _CAR_SEGMENT["hatchback"])
    if str(answers.get("condition")) == "used":
        base *= 0.6
    years = _years(answers)
    cond = "a used" if str(answers.get("condition")) == "used" else "a new"
    rationale = f"On-road price of {cond} {_CAR_SEGMENT_LABEL.get(seg, 'car')[2:]}, grown for car-price inflation."
    assumptions = [f"{cond.capitalize()} {_CAR_SEGMENT_LABEL.get(seg, 'car')[2:]}", "~5% price inflation a year"]
    return _result(base, 0.05, years, rationale, assumptions)


def _estimate_education(answers: dict[str, Any], profile: dict[str, Any] | None) -> dict[str, Any]:
    level = str(answers.get("level") or "undergrad")
    locale = str(answers.get("locale") or "india")
    base = _EDU_BASE.get(level, _EDU_BASE["undergrad"]).get(locale, _EDU_BASE["undergrad"]["india"])
    years = _years(answers)
    where = "abroad" if locale == "abroad" else "in India"
    rationale = (
        f"Typical full cost of {_EDU_LEVEL_LABEL.get(level, 'a degree')} {where} today, "
        "grown at education inflation (which runs higher than normal)."
    )
    assumptions = [f"{_EDU_LEVEL_LABEL.get(level, 'a degree').capitalize()} {where}", "~10% education inflation a year"]
    return _result(base, 0.10, years, rationale, assumptions)


def _estimate_wedding(answers: dict[str, Any], profile: dict[str, Any] | None) -> dict[str, Any]:
    scale = str(answers.get("scale") or "moderate")
    base = _WEDDING_SCALE.get(scale, _WEDDING_SCALE["moderate"]) * _city_mult(answers, profile, "tier1")
    years = _years(answers)
    rationale = f"What {_WEDDING_SCALE_LABEL.get(scale, 'a wedding')} broadly runs to today, grown for inflation."
    assumptions = [_WEDDING_SCALE_LABEL.get(scale, "a wedding").capitalize(), "~7% inflation a year"]
    return _result(base, 0.07, years, rationale, assumptions)


def _estimate_travel(answers: dict[str, Any], profile: dict[str, Any] | None) -> dict[str, Any]:
    locale = str(answers.get("locale") or "domestic")
    travellers = _TRAVEL_TRAVELLERS.get(str(answers.get("travelers") or "couple"), 2)
    base = _TRAVEL_PER_PERSON.get(locale, _TRAVEL_PER_PERSON["domestic"]) * travellers
    years = _years(answers)
    where = "an international" if locale == "international" else "a domestic"
    rationale = f"Ballpark for {where} trip for {travellers} traveller(s), grown for travel inflation."
    assumptions = [f"{where.capitalize()} trip, {travellers} traveller(s)", "~6% travel inflation a year"]
    return _result(base, 0.06, years, rationale, assumptions)


def _estimate_business(answers: dict[str, Any], profile: dict[str, Any] | None) -> dict[str, Any]:
    scale = str(answers.get("scale") or "small")
    base = _BUSINESS_SCALE.get(scale, _BUSINESS_SCALE["small"])
    years = _years(answers)
    rationale = f"Rough starting capital for {_BUSINESS_SCALE_LABEL.get(scale, 'a business')}, grown for inflation."
    assumptions = [_BUSINESS_SCALE_LABEL.get(scale, "a business").capitalize(), "~6% inflation a year"]
    return _result(base, 0.06, years, rationale, assumptions)


def _estimate_other(answers: dict[str, Any], profile: dict[str, Any] | None) -> dict[str, Any]:
    price_range = str(answers.get("price_range") or "")
    ballpark = str(answers.get("ballpark") or "")
    if price_range in _OTHER_PRICE_RANGE:
        base = _OTHER_PRICE_RANGE[price_range]
    elif ballpark in _OTHER_BALLPARK:
        base = _OTHER_BALLPARK[ballpark]
    else:
        base = 50_000
    years = _years(answers)
    rationale = "A rough starting figure for this goal — adjust it to what you have in mind."
    assumptions = ["A rough estimate you can fine-tune"]
    return _result(base, 0.06, years, rationale, assumptions)


# ── profile-derived goals (no inflation; computed from the user's own numbers) ──

def _annual_living(profile: dict[str, Any] | None) -> int:
    p = profile or {}
    monthly = int(p.get("rent") or 0) + int(p.get("monthlyExpenses") or 0)
    if monthly <= 0:
        income = int(p.get("monthlyCashInflow") or 0) or (int(p.get("monthlySalary") or 0) + int(p.get("otherIncome") or 0))
        monthly = int(income * 0.6)
    return monthly * 12


_FIRE_LIFESTYLE = {"lean": 1.0, "comfortable": 1.3, "lavish": 1.8}
_FIRE_LIFESTYLE_LABEL = {"lean": "the same lifestyle", "comfortable": "a more comfortable lifestyle", "lavish": "a lavish lifestyle"}
_DEBT_OWE = {"under1l": 75_000, "1-5l": 300_000, "5-15l": 1_000_000, "15l+": 2_500_000}


def _estimate_fire(answers: dict[str, Any], profile: dict[str, Any] | None) -> dict[str, Any]:
    key = str(answers.get("lifestyle") or "comfortable")
    mult = _FIRE_LIFESTYLE.get(key, 1.3)
    amount = _round_nice(_annual_living(profile) * mult * 25)
    low, high = _band(amount)
    return {
        "amount": amount,
        "low": low,
        "high": high,
        "rationale": "Roughly 25 times a year of your living costs, so the returns alone can cover your expenses (the 4% rule).",
        "assumptions": ["25x annual expenses (the 4% rule)", _FIRE_LIFESTYLE_LABEL.get(key, "a comfortable lifestyle").capitalize()],
    }


def _estimate_debt(answers: dict[str, Any], profile: dict[str, Any] | None) -> dict[str, Any]:
    p = profile or {}
    actual = int(p.get("creditCardDebt") or 0)
    loans = p.get("emiLoans")
    if isinstance(loans, list):
        for loan in loans:
            actual += int((loan or {}).get("principalAmount") or 0)
    if actual > 0:
        amount = _round_nice(actual)
        rationale = "Based on the credit-card and loan balances in your profile."
        assumptions = ["Your credit card + loan balances"]
    else:
        amount = _round_nice(_DEBT_OWE.get(str(answers.get("owe") or "1-5l"), 300_000))
        rationale = "A rough figure from the amount you said you owe."
        assumptions = ["Based on the rough amount you owe"]
    low, high = _band(amount)
    return {"amount": amount, "low": low, "high": high, "rationale": rationale, "assumptions": assumptions}


_DISPATCH = {
    "House purchase": _estimate_house,
    "Car purchase": _estimate_car,
    "Child education": _estimate_education,
    "Higher education": _estimate_education,
    "Marriage": _estimate_wedding,
    "Travel": _estimate_travel,
    "Business/startup": _estimate_business,
    "Retirement": _estimate_fire,
    "Financial freedom": _estimate_fire,
    "Debt repayment": _estimate_debt,
    "Other": _estimate_other,
}

# These are computed precisely from the user's own profile numbers, so they skip
# the LLM refinement (it would only add noise to an already-exact figure).
CALCULATOR_ONLY_GOAL_TYPES = frozenset({"Retirement", "Financial freedom", "Debt repayment"})

SUPPORTED_GOAL_TYPES = tuple(_DISPATCH.keys())


def estimate_goal(goal_type: str, answers: dict[str, Any] | None, profile: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return {amount, low, high, rationale, assumptions} for a goal type + answers."""
    fn = _DISPATCH.get(str(goal_type or "").strip())
    answers = answers or {}
    if fn is None:
        return _estimate_other(answers, profile)
    return fn(answers, profile)


def band_for(amount: int) -> tuple[int, int]:
    """A clean low–high range around a final amount."""
    return _band(int(amount))


def clamp_loose(amount: Any) -> int:
    """A wide sanity bound for free-form goals, where the LLM (not a cost table)
    sets the figure — so small items stay small and large ones stay large."""
    try:
        value = int(round(float(amount)))
    except (TypeError, ValueError):
        return 50_000
    return _round_nice(max(2_000, min(value, 5_000_000_000)))


def clamp_to_band(amount: Any, low: int, high: int) -> int:
    """Keep an LLM-suggested amount within a sane multiple of the deterministic
    band so a hallucinated figure can't land in the user's target field."""
    try:
        value = int(round(float(amount)))
    except (TypeError, ValueError):
        return _round_nice((low + high) / 2)
    floor = int(low * 0.5)
    ceil = int(high * 2.0)
    return _round_nice(max(floor, min(value, ceil)))
