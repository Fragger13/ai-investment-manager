"""Papa-style chat service.

The chat reads like an Indian dad's voice: warm, dry, real. The LLM
(llama3.1:8b via Ollama) generates the spoken text when available; cards
are computed deterministically from the user's actual profile so the chat
always renders rich numbers even when the LLM is offline.

The deterministic fallback below is what the user actually sees when
Ollama is down, so it has to sound natural on its own. No robotic
"focus on X, conviction Y%, suggested plan adjustment Z" output.
"""

from __future__ import annotations

import random
import re
from typing import Any

from sqlalchemy.orm import Session

from app.agents.chat_context_assembler_agent import assemble_chat_context
from app.schemas.financial import ChatCard, ChatResponse, OnboardingProfile
from app.services.chat.context_builder_service import build_chat_context
from app.services.intelligence import build_dashboard, current_ist_month, total_emi_payments
from app.services.llm.model_router import generate_chat_answer


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def papa_chat_answer(
    db: Session,
    message: str,
    profile: OnboardingProfile,
    history: list[dict] | None = None,
) -> ChatResponse:
    """Generate a Papa-style chat reply with optional rich cards.

    `history` is the prior conversation turns (oldest first), each a dict
    with `role` (user/assistant) and `content`. The last ~6 turns are
    woven into the LLM prompt so follow-up questions retain context.
    """
    context = assemble_chat_context(build_chat_context(db, profile))
    dashboard = build_dashboard(profile)
    intent = detect_intent(message)

    summary = dashboard.get("summary", {})
    available_now = _available_this_month(profile, dashboard)
    profile_extras = {
        **(context.get("profile") or {}),
        "name": profile.name,
        "age": profile.age,
        "occupation": profile.occupation,
        "city": profile.city,
        "maritalStatus": profile.maritalStatus,
        "monthlyIncome": summary.get("monthlyIncome"),
        "monthlyExpenses": summary.get("monthlyExpenses"),
        # Same figures the cards + the rest of the app show, so the LLM's spoken
        # numbers stay consistent with what the user sees elsewhere.
        "monthlyCommitments": round(_monthly_commitments(profile)),
        "monthlySurplus": round(available_now),
        "availableToInvest": round(available_now),
        "affordableMonthlyPayment": _affordable_monthly(summary.get("monthlyIncome") or 0, available_now),
        "rent": profile.rent,
        "subscriptions": profile.subscriptions,
        "emi": profile.emi,
        "savingsRate": summary.get("savingsRate"),
        "totalInvestments": (
            (profile.stocksValue or 0)
            + (profile.mutualFundsValue or 0)
            + (profile.cryptoValue or 0)
            + (profile.goldValue or 0)
            + (profile.epfPpfValue or 0)
            + (profile.realEstateValue or 0)
            + (profile.cashBalance or 0)
        ),
        "cashBalance": profile.cashBalance,
        "emergencyFundMonths": dashboard.get("health", {}).get("emergencyFundMonths"),
        "shortTermLossTolerance": profile.shortTermLossTolerance,
        "investmentHorizon": profile.investmentHorizon,
        "spendingDiscipline": profile.spendingDiscipline,
        "investsMonthly": profile.investsMonthly,
        "investingBlocker": profile.investingBlocker,
        "emiLoans": [
            {
                "name": loan.name or loan.productType,
                "monthlyEmi": loan.monthlyEmiAmount,
                "productType": loan.productType,
            }
            for loan in (profile.emiLoans or [])
            if (loan.monthlyEmiAmount or 0) > 0 or loan.name
        ],
        "goals": [
            {
                "type": goal.type,
                "name": goal.customName or goal.type,
                "targetAmount": goal.targetAmount,
                "currentAmount": goal.currentAmount,
                "targetDate": goal.targetDate,
                "priority": goal.priority,
            }
            for goal in (profile.goals or [])
        ],
    }
    context["profile"] = profile_extras
    if history:
        context["conversationHistory"] = history[-6:]

    baseline = _papa_baseline(message, intent, profile, dashboard)
    reply = generate_chat_answer(message, context, baseline)
    if not reply or not reply.strip():
        reply = baseline

    cards = _build_cards(intent, profile, dashboard, message)
    suggestions = _build_suggestions(intent)
    mood = _mood_for_intent(intent, dashboard)

    return ChatResponse(reply=reply.strip(), cards=cards, suggestions=suggestions, mood=mood)


# ---------------------------------------------------------------------------
# Intent detection
# ---------------------------------------------------------------------------


def detect_intent(message: str) -> str:
    text = (message or "").lower()
    # Life events first — these are common chat questions and the old
    # generic-recommendation fallback handled them terribly.
    if any(w in text for w in ["married", "marriage", "wedding", "shaadi", "engagement"]):
        return "marriage"
    if any(w in text for w in ["baby", "kid", "child", "pregnancy", "newborn", "parent"]):
        if any(w in text for w in ["expecting", "plan", "having", "want a", "want kids", "child education"]):
            return "kids"
    if any(w in text for w in ["new job", "switching jobs", "switch job", "quit", "resignation", "lost my job", "unemployed"]):
        return "job_change"
    if any(w in text for w in ["moving", "shifting", "relocate", "new city", "new house", "new flat"]):
        return "moving"
    if any(w in text for w in ["vacation", "trip", "travel abroad", "europe", "asia trip"]):
        return "travel"

    if any(w in text for w in ["house", "home", "flat", "apartment", "property"]) and any(
        w in text for w in ["afford", "buy", "should i", "can i"]
    ):
        return "afford_house"
    if any(w in text for w in ["car", "bike", "phone", "iphone", "laptop", "tv", "watch", "gadget"]) and any(
        w in text for w in ["afford", "buy", "purchase", "get a", "should i", "can i"]
    ):
        return "afford_purchase"
    if any(w in text for w in ["afford", "buy", "purchase"]):
        return "afford_purchase"

    if any(w in text for w in ["emergency", "buffer", "rainy day"]):
        return "emergency"
    if any(w in text for w in ["debt", "loan", "emi", "pay off"]):
        return "debt"
    if any(w in text for w in ["retire", "retirement", "fire"]):
        return "retire"
    if any(w in text for w in ["score", "health", "doing", "how am i"]):
        return "health"
    if any(w in text for w in ["save", "saving", "savings"]):
        return "savings"
    if any(w in text for w in ["invest", "sip", "mutual fund", "stocks", "where should i put"]):
        return "invest"
    if any(w in text for w in ["goal", "track", "on track", "behind"]):
        return "goal"
    if any(w in text for w in ["budget", "spend", "expense", "overspending"]):
        return "spending"
    return "general"


# ---------------------------------------------------------------------------
# Helpers for natural Papa-voice phrasing
# ---------------------------------------------------------------------------


def _first_name(profile: OnboardingProfile) -> str:
    parts = (profile.name or "").strip().split()
    return parts[0] if parts else ""


def _opener(profile: OnboardingProfile, choices: list[str]) -> str:
    """Pick one of several openers. Keeps Papa from sounding scripted."""
    return random.choice(choices)


def _money_str(amount: float) -> str:
    return f"Rs {amount:,.0f}"


def _months_from_message(message: str, default: int = 6) -> int:
    """Best-effort extraction of a time horizon from the user's message."""
    text = message.lower()
    match = re.search(r"(\d+)\s*(?:month|months|mo)", text)
    if match:
        return max(1, int(match.group(1)))
    match = re.search(r"(\d+)\s*(?:year|years|yr|yrs)", text)
    if match:
        return max(1, int(match.group(1)) * 12)
    if "next year" in text or "by next year" in text:
        return 12
    return default


def _monthly_commitments(profile: OnboardingProfile) -> float:
    """Mirror the frontend's monthlyCommitments exactly (rent + monthly expenses
    + EMIs) so the chat's numbers match the Dashboard, Plan and Portfolio."""
    return float(profile.rent or 0) + float(profile.monthlyExpenses or 0) + float(total_emi_payments(profile))


def _available_this_month(profile: OnboardingProfile, dashboard: dict) -> float:
    """The same 'available to invest this month' shown everywhere else: the
    per-month override when set for the current month, else income − commitments.
    Income − commitments == available, so the chat's three numbers reconcile."""
    income = float(dashboard.get("summary", {}).get("monthlyIncome") or 0)
    if (profile.investableThisMonth or 0) > 0 and profile.investableThisMonthMonth == current_ist_month():
        return float(profile.investableThisMonth)
    return max(income - _monthly_commitments(profile), 0.0)


def _surplus(profile: OnboardingProfile, dashboard: dict) -> float:
    return _available_this_month(profile, dashboard)


def _affordable_monthly(income: float, available: float) -> int:
    """A monthly payment toward a new purchase/EMI that won't strain cash flow:
    at most 20% of income, and never more than the actual monthly surplus."""
    cap = round(float(income) * 0.20)
    return max(min(cap, round(float(available))), 0)


# ---------------------------------------------------------------------------
# Deterministic Papa baseline — has to sound natural on its own
# ---------------------------------------------------------------------------


def _papa_baseline(message: str, intent: str, profile: OnboardingProfile, dashboard: dict) -> str:
    """Build a Papa-voice answer for the given intent + user state.

    Tone: like a real dad mid-conversation. Beta is sprinkled, not stamped.
    No conviction-score / suggested-plan-adjustment robotic language.
    """
    name = _first_name(profile)
    s = dashboard.get("summary", {})
    income = float(s.get("monthlyIncome") or 0)
    expenses = float(s.get("monthlyExpenses") or 0)
    available = _surplus(profile, dashboard)
    months_buffer = float(dashboard.get("health", {}).get("emergencyFundMonths") or 0)

    if intent == "marriage":
        months = _months_from_message(message, default=6)
        target_low, target_high = 800_000, 1_500_000
        per_month_low = round(target_low / months)
        if income <= 0:
            return (
                f"Arrey, congratulations beta. But first — I don't even know your income yet. "
                f"Tell me what you make and what your expenses look like, then I can stop guessing and do "
                f"the actual math."
            )
        if available <= 0:
            return (
                f"Congrats first, beta. But here's the truth — right now you barely have any spare cash after "
                f"expenses and EMIs. A {months}-month wedding needs family help, a smaller scale, or some "
                f"serious trimming. What's the target budget you're working with?"
            )
        return (
            f"Arrey, {months} months — congratulations. A simple Indian wedding lands around Rs 8-15 lakhs, "
            f"and that's if you keep the guest list in check. To save Rs {target_low // 100000} lakhs in "
            f"{months} months you'd need about {_money_str(per_month_low)}/month — your surplus is around "
            f"{_money_str(available)}. So either family is chipping in, you're going modest, or you're "
            f"trimming other goals temporarily. What's your target budget, beta?"
        )

    if intent == "kids":
        return (
            "Acha, kids on the way? Wonderful — and expensive. Expect Rs 25,000-50,000 extra monthly once "
            "they arrive, and by the time college comes, easily 25-50 lakhs just for that. Start a small SIP "
            "today, beta, before life gets busier. Time compounds; procrastination compounds harder."
        )

    if intent == "job_change":
        if months_buffer < 3:
            return (
                f"Beta, switching jobs with only {months_buffer:.1f} months of buffer? That's not a "
                f"transition, that's a free fall. Build the cushion to at least 6 months first. Anything "
                f"less is gambling with your rent — and your peace of mind."
            )
        return (
            f"Good — {months_buffer:.1f} months of buffer gives you real options. During the switch, no big "
            f"purchases and no new EMIs, theek hai? Add 2-3 months extra cushion if there's a gap. Once you "
            f"join, redo your goals and SIPs to match the new salary."
        )

    if intent == "moving":
        return (
            f"Moving is more expensive than people think — deposit, broker, packers, new appliances. "
            f"Budget at least 3 months of rent just for the move itself, beta. Right now your rent is "
            f"{_money_str(float(profile.rent or 0))}/month. If you're upgrading, keep total housing "
            f"(rent or EMI) under 35% of {_money_str(income)}/month — anything more and you're stretched thin."
        )

    if intent == "travel":
        return (
            f"Arrey, a holiday — finally taking a break? International easily 1.5-3 lakhs per person, "
            f"domestic 30-60k. With your surplus of {_money_str(available)}/month, plan for it gradually or "
            f"set up a dedicated travel goal. And beta — never put a vacation on a credit card you can't "
            f"clear in one cycle. Memories shouldn't earn 36% interest."
        )

    if intent == "afford_purchase":
        if available <= 0:
            return (
                "With nothing left after expenses and EMIs, this isn't the time, beta. Fix the cash flow "
                "first — then we can talk about the new toy."
            )
        monthly = _affordable_monthly(income, available)
        return (
            f"Acha, let me see — you have around {_money_str(available)}/month spare after expenses and EMIs. "
            f"You can consider it, but keep the monthly payment under {_money_str(monthly)} so it doesn't eat "
            f"into your other goals. Spread over 6-12 months, that's roughly a "
            f"{_money_str(monthly * 6)}-{_money_str(monthly * 12)} purchase."
        )

    if intent == "afford_house":
        if available <= 0:
            return (
                "Beta, a house is a 20-year decision — not something to rush. Right now your cash flow is "
                "too thin to even consider it. Fix that first, save up the down payment, and then we talk "
                "about the loan. In that order."
            )
        emi_cap = round(income * 0.35)
        return (
            f"For a home loan, keep the EMI under {_money_str(emi_cap)}/month — 35% of income is the upper "
            f"limit before life gets uncomfortable. Your surplus of {_money_str(available)}/month gives "
            f"breathing room. The real challenge is the down payment, usually 20% of property value. Tell me "
            f"what property price you're eyeing, beta, and I'll show you the actual math."
        )

    if intent == "savings":
        rate = float(s.get("savingsRate") or 0)
        if rate >= 25:
            return (
                f"Saving {rate:.0f}% — acha, you actually listen. Most people don't get here. Now don't get "
                f"lazy — same discipline through bonuses and salary hikes. That's how real wealth quietly builds."
            )
        if rate >= 10:
            return (
                f"{rate:.0f}% — decent, but a real Indian household aims for 20-30%, beta. Cut a couple of "
                f"indulgences — eating out twice a week instead of four, one subscription gone — and you'll "
                f"hit 25% without even noticing."
            )
        return (
            f"Arrey beta, only {rate:.0f}%? That's not saving, that's whatever happens to survive your "
            f"spending. Flip the order — set aside Rs {round(income * 0.20):,} first thing every month, then "
            f"spend what remains. It's the only thing that actually works."
        )

    if intent == "invest":
        if available < 5000:
            return (
                "Investing is exciting, beta, but the basics come first. Six months of emergency savings "
                "before chasing any returns. A flat tyre without savings has destroyed more financial plans "
                "than any bad stock pick. Believe me."
            )
        sip_amount = round(available * 0.60)
        return (
            f"You have about {_money_str(available)} extra each month. A diversified equity SIP of "
            f"{_money_str(sip_amount)} is a sensible start. Boring works, beta. Don't chase fancy stocks or "
            f"crypto until the basics are in place — emergency fund, term insurance, health insurance. "
            f"In that order."
        )

    if intent == "retire":
        age = int(profile.age or 0)
        years_left = max(60 - age, 0)
        if years_left <= 0:
            return (
                "You're at or past retirement age, beta. Focus shifts now — capital preservation, steady "
                "income, low-risk allocation. Tell me your current corpus and I'll walk through how long "
                "it will actually last."
            )
        return (
            f"Retirement is {years_left} years out, beta. {_money_str(available)}/month, compounded all the "
            f"way, can build a serious corpus — but only if you start today and stop touching it. "
            f"Aim for 20-25 times your annual expenses before you call it quits."
        )

    if intent == "goal":
        goals = profile.goals or []
        if not goals:
            return (
                "Beta, you haven't told me about any goals yet. How am I supposed to tell you if you're on "
                "track for something you haven't named? Add a goal — house, kids' school, retirement, "
                "anything — and I'll do the math."
            )
        first = goals[0]
        name_str = first.customName or first.type
        target = float(first.targetAmount or 0)
        return (
            f"Your top goal is {name_str}, target {_money_str(target)}. Set up an automatic monthly transfer "
            f"toward it, beta — like clockwork. A goal without a monthly SIP is just a wish, and Papa "
            f"doesn't fund wishes."
        )

    if intent == "health":
        score = int(dashboard.get("health", {}).get("score") or 0)
        if score >= 75:
            return (
                f"{score}/100 — quietly impressive, beta. Don't get cocky — discipline got you here, "
                f"complacency takes it away. Keep showing up."
            )
        if score >= 50:
            return (
                f"{score}/100 — middle of the pack. Not in trouble, but acha, there's clear room to do "
                f"better. Open the dashboard, pick the weakest area, and fix that one first. "
                f"Don't try to fix everything at once."
            )
        return (
            f"{score}/100 — there's work to do, beta. Pick one thing — usually the emergency fund — and fix "
            f"it first. Trying to fix five things at once is how people give up by month two."
        )

    if intent == "debt":
        if (profile.emi or 0) <= 0:
            return (
                "No EMIs — financial freedom's favourite child. Don't ruin it by buying things on credit "
                "you can't clear in 30 days, theek hai?"
            )
        debt_ratio = (float(profile.emi or 0) / income * 100) if income else 0
        if debt_ratio > 35:
            return (
                f"Beta, {debt_ratio:.0f}% of income going to EMIs — that's too much. Above 35% and you're "
                f"choking your future for the present. Either consolidate to a lower rate or attack the "
                f"highest-interest loan first. Pick one and start."
            )
        return (
            f"{debt_ratio:.0f}% to EMIs — manageable. Pay on time, no new lifestyle debt, and put extra "
            f"surplus toward the costliest loan first. Math wins every time, beta."
        )

    if intent == "spending":
        ratio = (expenses / income * 100) if income else 0
        if ratio > 70:
            return (
                f"Arrey beta, {ratio:.0f}% of income going to expenses? That's surviving, not living. Open "
                f"the last three months of statements — I guarantee you'll find at least Rs 5,000 of obvious "
                f"waste. Cancel something. Anything."
            )
        return (
            f"{ratio:.0f}% — within reason. But beta, keep an eye on the small stuff. A coffee a day is "
            f"Rs 9,000 a year. Multiply that by everything 'small' and you'll see why it matters."
        )

    if intent == "emergency":
        months = months_buffer
        target = round(expenses * 6)
        current = float(profile.cashBalance or 0)
        if months >= 6:
            return (
                "Six months of expenses sitting safely — exactly what a Papa wants to hear. Now leave it "
                "alone, beta. This isn't your holiday fund or your wedding fund. This is your "
                "'something just went very wrong' fund."
            )
        if months >= 3:
            return (
                f"{months:.1f} months saved — decent start, beta. Push it to 6 months, which is roughly "
                f"{_money_str(max(target - current, 0))} more, and you can sleep peacefully through almost "
                f"any storm."
            )
        return (
            f"Only {months:.1f} months saved — beta, that's not a fund, that's a hiccup away from disaster. "
            f"Stop everything else and build this to 3 months first. Then 6. Then we'll talk about investing."
        )

    # ---------------- General catch-all -----------------------------------
    if not name and not income:
        return (
            "Honestly beta, I don't know enough about you yet. Tell me about your income, expenses, EMIs, "
            "or what's actually on your mind — then I can give you a real answer instead of a generic one."
        )
    if available <= 0:
        return (
            "From what I see, your monthly cash flow is tight, beta — barely anything left after expenses "
            "and EMIs. Whatever you're planning, fixing the cash flow first will make every other decision "
            "easier. What's actually on your mind?"
        )
    return (
        f"Acha, you have about {_money_str(available)}/month of surplus to play with. Tell me what's on "
        f"your mind, beta — a purchase, a goal, a life decision — and I'll work through the math with you."
    )


# ---------------------------------------------------------------------------
# Card building
# ---------------------------------------------------------------------------


def _build_cards(intent: str, profile: OnboardingProfile, dashboard: dict, message: str) -> list[ChatCard]:
    """Build structured rich cards. Returns [] if no cards apply."""
    cards: list[ChatCard] = []
    s = dashboard.get("summary", {})
    income = float(s.get("monthlyIncome") or 0)
    expenses = float(s.get("monthlyExpenses") or 0)
    commitments = _monthly_commitments(profile)
    available = _available_this_month(profile, dashboard)

    snapshot_intents = {
        "afford_purchase",
        "afford_house",
        "marriage",
        "kids",
        "moving",
        "travel",
        "invest",
        "savings",
        "spending",
        "debt",
        "job_change",
    }
    if intent in snapshot_intents and income > 0:
        cards.append(
            ChatCard(
                type="metrics",
                intro="Based on your current financial profile, here's my analysis:",
                metrics=[
                    {"label": "Monthly income", "amount": round(income), "icon": "wallet"},
                    {"label": "Monthly commitments", "amount": round(commitments), "icon": "calendar"},
                    {"label": "Available to invest/save", "amount": round(available), "icon": "check"},
                ],
            )
        )

    if intent == "marriage":
        months = _months_from_message(message, default=6)
        per_month = round(1_200_000 / months)  # mid-range 12L target
        cards.append(
            ChatCard(
                type="recommendation",
                title="A workable wedding plan",
                body=(
                    f"For a Rs 8-15 lakh wedding in {months} months, you'd need to set aside "
                    f"about {_money_str(per_month)}/month. Adjust based on your target budget and family help."
                ),
                icon="target",
                tone="positive" if available >= per_month * 0.5 else "warning",
            )
        )
    elif intent == "afford_purchase":
        monthly = _affordable_monthly(income, available)
        if monthly > 0:
            body = (
                f"Keep the monthly outgo under about {_money_str(monthly)} — that comfortably supports a "
                f"purchase of {_money_str(monthly * 6)} – {_money_str(monthly * 12)} spread over 6–12 months, "
                f"without straining your cash flow."
            )
        else:
            body = (
                "There's very little spare each month right now, so a new EMI would strain things. "
                "Free up some cash flow first, then this becomes comfortable."
            )
        cards.append(
            ChatCard(
                type="recommendation",
                title="My recommendation",
                body=body,
                icon="target",
                tone="positive" if monthly > 0 else "warning",
            )
        )
        cards.append(
            ChatCard(
                type="options",
                options=[
                    {"label": "Yes, show me options", "primary": True},
                    {"label": "No, thanks", "primary": False},
                ],
            )
        )
    elif intent == "afford_house":
        emi_cap = round(income * 0.35)
        cards.append(
            ChatCard(
                type="recommendation",
                title="Keep the EMI under this",
                body=(
                    f"Home loan EMI should stay under {_money_str(emi_cap)}/month. "
                    f"Plan the down payment (~20% of property price) first."
                ),
                icon="home",
                tone="positive" if available > 0 else "warning",
            )
        )
    elif intent == "invest":
        suggested = max(round(available * 0.60), 1000)
        cards.append(
            ChatCard(
                type="recommendation",
                title="Start here",
                body=(
                    f"A monthly SIP of about {_money_str(suggested)} in a diversified equity mutual fund "
                    f"is a sensible first move. Boring compounds."
                ),
                icon="trending-up",
                tone="positive",
            )
        )
    elif intent == "savings":
        target = round(income * 0.25)
        cards.append(
            ChatCard(
                type="recommendation",
                title="A target worth aiming for",
                body=(
                    f"Aim to save {_money_str(target)}/month — about 25% of income. "
                    f"Set it aside first, spend the rest."
                ),
                icon="piggy-bank",
                tone="positive",
            )
        )
    elif intent == "debt" and (profile.emi or 0) > 0:
        cards.append(
            ChatCard(
                type="recommendation",
                title="Stay safe with debt",
                body=(
                    "Pay on time, avoid new lifestyle debt, and direct any extra surplus toward "
                    "the highest-interest loan first."
                ),
                icon="credit-card",
                tone="warning",
            )
        )
    elif intent == "health":
        score = int(dashboard.get("health", {}).get("score") or 0)
        tone = "positive" if score >= 70 else "warning"
        cards.append(
            ChatCard(
                type="recommendation",
                title=f"Financial Health: {score}/100",
                body="Score blends savings rate, emergency cover, debt ratio, and goal progress.",
                icon="shield",
                tone=tone,
            )
        )
    elif intent == "goal":
        goals = profile.goals or []
        if goals:
            top = goals[0]
            target = float(top.targetAmount or 0)
            current = float(top.currentAmount or 0)
            cards.append(
                ChatCard(
                    type="metrics",
                    intro=f"Top goal: {top.customName or top.type}",
                    metrics=[
                        {"label": "Target", "amount": round(target), "icon": "target"},
                        {"label": "Saved so far", "amount": round(current), "icon": "check"},
                        {"label": "Still to go", "amount": round(max(target - current, 0)), "icon": "arrow-right"},
                    ],
                )
            )
    elif intent == "emergency":
        months = float(dashboard.get("health", {}).get("emergencyFundMonths") or 0)
        target = round(expenses * 6)
        current = round(float(profile.cashBalance or 0))
        cards.append(
            ChatCard(
                type="metrics",
                intro=f"Emergency fund: {months:.1f} months of expenses",
                metrics=[
                    {"label": "Target (6 mo)", "amount": target, "icon": "shield"},
                    {"label": "Saved so far", "amount": current, "icon": "check"},
                    {"label": "Still to go", "amount": max(target - current, 0), "icon": "arrow-right"},
                ],
            )
        )

    return cards


# ---------------------------------------------------------------------------
# Follow-up suggestions
# ---------------------------------------------------------------------------


def _build_suggestions(intent: str) -> list[str]:
    if intent == "marriage":
        return ["What if I have only 3 months?", "How much should family contribute?", "Should I take a personal loan?"]
    if intent == "kids":
        return ["Start a child education SIP?", "How much insurance do I need?", "When should I start saving?"]
    if intent == "job_change":
        return ["How big should my buffer be?", "Should I take a pay cut for a role?", "Tax implications of a switch?"]
    if intent == "moving":
        return ["Rent vs buy?", "How much for the deposit?", "Cut commute or cost?"]
    if intent == "travel":
        return ["How do I plan a Rs 2L trip?", "Credit card or savings?", "Best month to book?"]
    if intent == "afford_purchase":
        return ["Show me a 12-month savings plan", "What if I take a loan?", "Is this the right time?"]
    if intent == "afford_house":
        return ["How much down payment?", "How long should the loan be?", "Should I rent instead?"]
    if intent == "invest":
        return ["Which SIP should I start?", "Is crypto worth it?", "How much risk should I take?"]
    if intent == "savings":
        return ["Where should I save it?", "Am I overspending somewhere?", "Show me a monthly budget"]
    if intent == "retire":
        return ["When can I retire?", "How much corpus do I need?", "What if I retire 5 years early?"]
    if intent == "goal":
        return ["Am I on track?", "What if I miss the date?", "Add a new goal"]
    if intent == "health":
        return ["What's pulling my score down?", "What should I fix first?", "How fast can I improve?"]
    if intent == "debt":
        return ["Should I prepay my loan?", "Consolidate my debts?", "What's a healthy debt ratio?"]
    if intent == "spending":
        return ["Where am I overspending?", "Show me a budget", "Cut my subscriptions?"]
    if intent == "emergency":
        return ["Where should I keep it?", "Liquid fund vs FD?", "Why is 6 months important?"]
    return ["Can I afford a car?", "Am I saving enough?", "What should I do today?"]


def _mood_for_intent(intent: str, dashboard: dict) -> str:
    score = int(dashboard.get("health", {}).get("score") or 50)
    if intent in {"afford_purchase", "afford_house", "spending", "moving"}:
        return "thoughtful"
    if intent in {"savings", "invest", "travel"}:
        return "caring"
    if intent in {"retire", "goal", "marriage", "kids"}:
        return "loving"
    if intent == "health":
        if score >= 70:
            return "proud"
        if score >= 40:
            return "gentle"
        return "concerned"
    if intent in {"debt", "emergency", "job_change"}:
        return "concerned"
    return "warm"
