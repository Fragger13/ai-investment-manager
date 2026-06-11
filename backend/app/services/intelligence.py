from __future__ import annotations

from datetime import UTC, datetime
from math import ceil

from app.schemas.financial import OnboardingProfile


DISCLAIMER = (
    "This is educational decision support, not a promise of financial results. "
    "Investments involve market risk. Please verify sources and suitability before investing."
)


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def profile_to_dict(profile: OnboardingProfile) -> dict:
    return profile.model_dump(mode="json")


def calculate_age(date_of_birth: str, fallback: int = 0) -> int:
    if not date_of_birth:
        return fallback
    try:
        born = datetime.strptime(date_of_birth, "%Y-%m-%d").date()
    except ValueError:
        return fallback
    today = datetime.now(UTC).date()
    return max(today.year - born.year - ((today.month, today.day) < (born.month, born.day)), 0)


def monthly_income(profile: OnboardingProfile) -> int:
    return int(profile.monthlySalary + profile.otherIncome)


def total_emi_payments(profile: OnboardingProfile) -> int:
    if profile.emiLoans:
        return int(sum(item.monthlyEmiAmount for item in profile.emiLoans))
    return int(profile.emi)


def recurring_liabilities(profile: OnboardingProfile) -> int:
    return int(profile.rent + profile.subscriptions + total_emi_payments(profile))


def net_worth(profile: OnboardingProfile) -> int:
    additional = sum(item.value for item in profile.additionalInvestments)
    return int(
        profile.stocksValue
        + profile.mutualFundsValue
        + profile.cryptoValue
        + profile.goldValue
        + profile.epfPpfValue
        + profile.realEstateValue
        + profile.cashBalance
        + additional
        - profile.creditCardDebt
        - profile.loans
    )


def emi_amount(principal: int, annual_rate: float, years: int) -> int:
    if principal <= 0 or years <= 0:
        return 0
    monthly_rate = annual_rate / 100 / 12
    months = years * 12
    if monthly_rate <= 0:
        return round(principal / months)
    return round(principal * monthly_rate * ((1 + monthly_rate) ** months) / (((1 + monthly_rate) ** months) - 1))


def corpus_for_income(yearly_income: int, withdrawal_rate: float) -> int:
    rate = max(withdrawal_rate, 1) / 100
    return round(yearly_income / rate)


def months_until(date_value: str, fallback: int = 60) -> int:
    if not date_value:
        return fallback
    try:
        target = datetime.strptime(date_value, "%Y-%m-%d").date()
    except ValueError:
        return fallback
    today = datetime.now(UTC).date()
    return max((target.year - today.year) * 12 + target.month - today.month, 1)


def goal_display_name(goal) -> str:
    return goal.customName.strip() if goal.type == "Other" and goal.customName.strip() else goal.type or "Goal"


def calculated_goal_target(goal) -> int:
    if goal.type in {"Retirement", "Financial freedom"}:
        if goal.retirementInputType == "monthly":
            return corpus_for_income(goal.desiredMonthlyIncome * 12, goal.withdrawalRate)
        if goal.retirementInputType == "yearly":
            return corpus_for_income(goal.desiredYearlyIncome, goal.withdrawalRate)
    return int(goal.targetAmount)


def dynamic_goal_explanation(goal) -> str:
    explanations = {
        "Emergency fund": "Emergency money protects you from job loss, medical costs, or sudden expenses.",
        "Retirement": "Retirement planning estimates how much you need after active income slows down or stops.",
        "Financial freedom": "Financial freedom means building enough savings and investments to support the income you want.",
        "House purchase": "This compares saving first with a monthly loan payment so a home goal does not weaken your monthly budget.",
        "Car purchase": "This checks whether the car goal or EMI fits without crowding out higher-priority goals.",
        "Child education": "Education goals need early planning because costs can rise over time.",
        "Higher education": "This goal helps separate education savings from day-to-day spending.",
        "Marriage": "This helps plan a large family expense without using emergency savings.",
        "Travel": "This helps you save for a planned trip without affecting higher-priority goals.",
        "Debt repayment": "Repaying debt can free up money each month and reduce interest costs.",
        "Business/startup": "Startup capital should be planned separately because timing and risk can vary.",
        "Wealth creation": "Wealth creation is a long-term goal for growing net worth after basics are covered.",
    }
    return explanations.get(goal.type, "This goal is included in your priority order and monthly planning.")


def health_agent(profile: OnboardingProfile) -> dict:
    income = monthly_income(profile)
    worth = net_worth(profile)
    emi_total = total_emi_payments(profile)
    surplus = max(income - profile.monthlyExpenses - emi_total, 0)
    savings_rate = (surplus / income * 100) if income else 0
    expense_burden = (profile.monthlyExpenses / income * 100) if income else 0
    debt_burden = (emi_total / income * 100) if income else 0
    months_of_buffer = profile.cashBalance / max(profile.monthlyExpenses + emi_total, 1)
    score = 50 + min(savings_rate, 40) * 0.65 + min(months_of_buffer, 12) * 1.4 - min(debt_burden, 45) * 0.45
    if profile.investsMonthly.lower() in {"yes", "always"}:
        score += 4
    if profile.riskReaction == "Panic sell":
        score -= 5
    score = int(max(20, min(96, round(score))))

    strengths: list[str] = []
    weaknesses: list[str] = []
    actions: list[str] = []
    if savings_rate >= 25:
        strengths.append("You save a healthy share of your monthly income.")
    else:
        weaknesses.append("Your monthly savings rate is low, so goals may take longer.")
        actions.append("Try increasing savings by reducing one flexible expense category.")
    if months_of_buffer >= 6:
        strengths.append("Your cash buffer can cover several months of expenses.")
    else:
        weaknesses.append("Your emergency fund is below the usual 6-month comfort level.")
        actions.append("Build emergency savings before taking more short-term investment risk.")
    if debt_burden <= 20:
        strengths.append("Your EMI and debt pressure looks manageable.")
    else:
        weaknesses.append("Debt payments are taking a large share of income.")
        actions.append("Avoid adding new EMIs until savings rate improves.")
    return {
        "score": score,
        "explanation": "Your Financial Health Score is a simple score based on income, expenses, savings, debt, emergency money, goals, and behavior.",
        "whyItMatters": "A stronger score usually means you have more room to invest without hurting day-to-day stability.",
        "savingsRate": round(savings_rate, 1),
        "expenseBurden": round(expense_burden, 1),
        "debtBurden": round(debt_burden, 1),
        "emergencyFundMonths": round(months_of_buffer, 1),
        "netWorth": worth,
        "strengths": strengths or ["You have started organizing your financial profile."],
        "weaknesses": weaknesses or ["No major pressure point was detected from the information entered."],
        "actions": actions or ["Review this plan every month after updating income, expenses, and investments."],
    }


def behavior_agent(profile: OnboardingProfile) -> dict:
    impulse = "High" if profile.emotionalSpendingTendency in {"High", "Often"} else "Moderate" if profile.emotionalSpendingTendency else "Needs review"
    panic = "High" if profile.riskReaction in {"Panic sell", "I may sell"} or profile.panicSellRisk in {"Yes", "Often"} else "Low"
    discipline = "Strong" if profile.spendingDiscipline in {"Strong", "High"} and profile.investsMonthly in {"Yes", "Always", "Often"} else "Improving"
    nudges = []
    if impulse == "High":
        nudges.append("Use a 24-hour pause before large discretionary purchases.")
    if panic == "High":
        nudges.append("Use smaller SIPs and avoid checking long-term investments daily.")
    if profile.tracksExpenses not in {"Yes", "Often"}:
        nudges.append("Track expenses weekly so recommendations stay accurate.")
    if profile.investingBlocker in {"Fear of losses", "Too many choices"}:
        nudges.append("Use simple, smaller monthly investments first so the habit feels manageable.")
    if not nudges:
        nudges.append("Keep investing consistently and review the plan monthly.")
    return {
        "spendingDiscipline": discipline,
        "impulseSpendingRisk": impulse,
        "panicSellingRisk": panic,
        "investmentDiscipline": "Consistent" if profile.investsMonthly in {"Yes", "Always", "Often"} else "Needs routine",
        "suggestedNudges": nudges,
    }


def market_sources() -> list[dict]:
    timestamp = now_iso()
    return [
        {
            "name": "NSE India",
            "url": "https://www.nseindia.com/market-data/live-equity-market",
            "retrievedAt": timestamp,
        },
        {
            "name": "AMFI India",
            "url": "https://www.amfiindia.com/research-information/other-data/mf-scheme-performance-details",
            "retrievedAt": timestamp,
        },
        {
            "name": "RBI",
            "url": "https://www.rbi.org.in/",
            "retrievedAt": timestamp,
        },
    ]


def research_agent(profile: OnboardingProfile) -> list[dict]:
    sources = market_sources()
    equity_tone = "Opportunity" if profile.investmentHorizon in {"7-10 years", "10+ years"} else "Neutral"
    return [
        {
            "title": "Broad-market index investing",
            "detail": "For beginners, broad index funds reduce single-stock risk because money is spread across many large companies.",
            "whyItMatters": "This can support long-term wealth creation without requiring daily stock picking.",
            "confidence": 82,
            "tone": equity_tone,
            "sources": sources[:2],
        },
        {
            "title": "Emergency money before high risk",
            "detail": "Short-duration debt or liquid funds are useful for money that may be needed soon.",
            "whyItMatters": "This lowers the chance of selling long-term investments during an emergency.",
            "confidence": 86,
            "tone": "Neutral",
            "sources": [sources[1], sources[2]],
        },
        {
            "title": "Short-term opportunities need strict limits",
            "detail": "Short-term ideas can move quickly, so the app keeps them to a small part of your monthly savings unless your comfort with risk is high.",
            "whyItMatters": "A limit helps protect your main goals if a short-term idea goes wrong.",
            "confidence": 70,
            "tone": "Warning",
            "sources": sources[:1],
        },
    ]


def recommendation_agent(profile: OnboardingProfile) -> list[dict]:
    income = monthly_income(profile)
    surplus = max(income - profile.monthlyExpenses - total_emi_payments(profile), 0)
    emergency_goal = next((goal for goal in profile.goals if goal.type == "Emergency fund"), None)
    emergency_needed = max((emergency_goal.targetAmount if emergency_goal else profile.emergencyFundTarget) or profile.monthlyExpenses * 6, profile.monthlyExpenses * 6)
    emergency_gap = max(emergency_needed - profile.cashBalance, 0)
    high_long_term_risk = profile.volatilityComfort == "High" or profile.investmentHorizon in {"7-10 years", "10+ years"}
    short_term_ok = profile.shortTermVolatilityComfort == "High" and profile.shortTermLossTolerance in {"10-15%", "15%+"}
    source_links = market_sources()

    debt_allocation = 35 if emergency_gap else 20
    equity_allocation = 45 if high_long_term_risk else 30
    tactical_allocation = 10 if short_term_ok else 5
    gold_allocation = 10
    total = debt_allocation + equity_allocation + tactical_allocation + gold_allocation
    scale = 100 / total if total else 1

    def amount(percent: int) -> int:
        return round(surplus * percent / 100)

    equity_percent = round(equity_allocation * scale)
    debt_percent = round(debt_allocation * scale)
    tactical_percent = round(tactical_allocation * scale)
    gold_percent = max(0, 100 - equity_percent - debt_percent - tactical_percent)

    recommendations = [
        {
            "id": "rec-nifty50-index",
            "assetClass": "Nifty 50 index fund or Nifty 50 ETF",
            "suggestedAllocation": equity_percent,
            "suggestedMonthlyAmount": amount(equity_percent),
            "strategyType": "Long-term growth",
            "entryTiming": "Use a monthly SIP so you do not need to guess the perfect entry day.",
            "exitTiming": "Review yearly or if your goal timeline changes.",
            "confidenceScore": 84 if high_long_term_risk else 74,
            "riskLevel": "Medium",
            "reasoning": "This gives diversified exposure to large Indian companies and fits a long-term wealth goal better than picking individual stocks as a beginner.",
            "whatCanGoWrong": "Equity markets can fall sharply for months or years. Do not use this for money needed soon.",
            "suitableFor": "Long-term goals such as retirement, financial freedom, or a goal more than 7 years away.",
            "timeHorizon": "7+ years",
            "reviewCondition": "Review if equity becomes more than your comfort level or if your emergency fund falls below 6 months.",
            "sourceLinks": source_links[:2],
            "scenarioProjection": {
                "best": "Good market years may grow faster than inflation.",
                "base": "Regular SIPs can build wealth over long periods with ups and downs.",
                "worst": "Temporary losses are possible; avoid panic-selling during market falls.",
            },
        },
        {
            "id": "rec-liquid-debt",
            "assetClass": "Liquid fund or short-duration debt fund",
            "suggestedAllocation": debt_percent,
            "suggestedMonthlyAmount": amount(debt_percent),
            "strategyType": "Stability and emergency money",
            "entryTiming": "Start immediately if emergency money is below the target.",
            "exitTiming": "Use this money for emergencies or short-term planned expenses.",
            "confidenceScore": 90 if emergency_gap else 78,
            "riskLevel": "Low",
            "reasoning": "You need money that is easier to access and moves less before taking more investment risk.",
            "whatCanGoWrong": "Returns can be modest and may change with interest rates. Credit risk depends on the fund.",
            "suitableFor": "Emergency fund, near-term goals, or users uncomfortable with market swings.",
            "timeHorizon": "0-3 years",
            "reviewCondition": "Review once cash plus liquid funds cover 6 months of expenses.",
            "sourceLinks": source_links[1:],
            "scenarioProjection": {
                "best": "Keeps money more stable and accessible while stock markets move up and down.",
                "base": "Helps complete emergency fund without taking high risk.",
                "worst": "May not beat inflation after tax in every period.",
            },
        },
        {
            "id": "rec-gold-sgb",
            "assetClass": "Gold ETF or Sovereign Gold Bond",
            "suggestedAllocation": gold_percent,
            "suggestedMonthlyAmount": amount(gold_percent),
            "strategyType": "Diversification",
            "entryTiming": "Add gradually after your emergency savings are on track.",
            "exitTiming": "Review if gold crosses 15% of total net worth.",
            "confidenceScore": 72,
            "riskLevel": "Medium",
            "reasoning": "A small gold investment can reduce dependence on only shares and mutual funds.",
            "whatCanGoWrong": "Gold can remain flat for long periods and does not create business earnings.",
            "suitableFor": "Users who want some protection from currency and market stress.",
            "timeHorizon": "3+ years",
            "reviewCondition": "Review yearly when you check your overall investment mix.",
            "sourceLinks": source_links[2:],
            "scenarioProjection": {
                "best": "Can help when equity markets or currency sentiment is weak.",
                "base": "Acts as a diversifier, not the main growth engine.",
                "worst": "May underperform equities over long periods.",
            },
        },
    ]
    if tactical_percent > 0:
        recommendations.append(
            {
                "id": "rec-tactical-capped",
                "assetClass": "Small short-term opportunity fund",
                "suggestedAllocation": tactical_percent,
                "suggestedMonthlyAmount": amount(tactical_percent),
                "strategyType": "Short-term opportunity",
                "entryTiming": "Only use after core SIP and emergency money are funded for the month.",
                "exitTiming": "Set a review date and stop-loss before entering.",
                "confidenceScore": 62 if short_term_ok else 52,
                "riskLevel": "High",
                "reasoning": "Your short-term risk answers allow a small opportunity bucket, but it should not disturb core goals.",
                "whatCanGoWrong": "Short-term calls can fail quickly. Losses should be capped before entry.",
                "suitableFor": "Users who can tolerate short-term ups and downs and want a small amount for short-term ideas.",
                "timeHorizon": "1-12 months",
                "reviewCondition": "Exit or reduce if it affects emergency fund, EMI comfort, or goal SIPs.",
                "sourceLinks": source_links[:1],
                "scenarioProjection": {
                    "best": "May add extra upside in strong short-term trends.",
                    "base": "Results can be mixed, so keeping the amount small limits the impact of a loss.",
                    "worst": "Can lose money quickly if momentum reverses.",
                },
            }
        )
    return recommendations


def goal_agent(profile: OnboardingProfile, worth: int, surplus: int) -> list[dict]:
    if profile.goals:
        income = monthly_income(profile)
        planned_goals = []
        for index, goal in enumerate(sorted(profile.goals, key=lambda item: (item.priority or 999, goal_display_name(item)))):
            target = calculated_goal_target(goal)
            current = int(goal.currentAmount or goal.downPayment or 0)
            loan_amount = max(target - int(goal.downPayment or 0), 0)
            estimated_goal_emi = emi_amount(loan_amount, goal.interestRate, goal.tenureYears) if goal.paymentStyle == "emi" else 0
            months = months_until(goal.targetDate, 6 if goal.type == "Emergency fund" else 60)
            required = estimated_goal_emi if goal.paymentStyle == "emi" else int(goal.monthlyContribution or ceil(max(target - current, 0) / max(months, 1)))
            warning = ""
            if estimated_goal_emi and income and ((total_emi_payments(profile) + estimated_goal_emi) / income) > 0.35:
                warning = "This EMI may take too much of your monthly income and reduce your ability to save for other goals."
            feasibility = min(95, max(10, round((surplus / max(required, 1)) * 70))) if required else 75
            slug = goal_display_name(goal).lower().replace("/", "-").replace(" ", "-")
            planned_goals.append(
                {
                    "id": f"goal-{goal.priority or index + 1}-{slug}",
                    "name": goal_display_name(goal),
                    "priority": goal.priority or index + 1,
                    "targetAmount": target,
                    "currentProgress": current,
                    "requiredMonthlyInvestment": required,
                    "feasibilityScore": feasibility,
                    "timelineProjection": f"{goal.tenureYears} year EMI" if goal.paymentStyle == "emi" else f"{months} month saving plan",
                    "explanation": dynamic_goal_explanation(goal),
                    "planType": goal.paymentStyle,
                    "estimatedEmi": estimated_goal_emi,
                    "affordabilityWarning": warning,
                }
            )
        return planned_goals

    age = calculate_age(profile.dateOfBirth, profile.age)
    travel_target = profile.travelTarget
    retirement_target = profile.retirementTarget
    if profile.retirementInputType == "monthly":
        retirement_target = corpus_for_income(profile.retirementMonthlyIncome * 12, profile.withdrawalRate)
    elif profile.retirementInputType == "yearly":
        retirement_target = corpus_for_income(profile.retirementYearlyIncome, profile.withdrawalRate)
    freedom_target = profile.financialFreedomTarget
    if profile.financialFreedomInputType == "monthly":
        freedom_target = corpus_for_income(profile.passiveMonthlyIncome * 12, profile.withdrawalRate)
    elif profile.financialFreedomInputType == "yearly":
        freedom_target = corpus_for_income(profile.passiveYearlyIncome, profile.withdrawalRate)

    house_loan = max(profile.housePurchaseTarget - profile.housePlan.downPayment, 0)
    house_emi = emi_amount(house_loan, profile.housePlan.interestRate, profile.housePlan.tenureYears) if profile.housePlan.mode == "emi" else 0
    emi_warning = ""
    income = monthly_income(profile)
    if house_emi and income and ((total_emi_payments(profile) + house_emi) / income) > 0.35:
        emi_warning = "This EMI may take too much of your monthly income and reduce your ability to save."

    retirement_years = max((profile.retirementAge or 60) - age, 1)

    goals = [
        {
            "id": "goal-emergency",
            "name": "Emergency fund",
            "targetAmount": max(profile.emergencyFundTarget, profile.monthlyExpenses * 6),
            "currentProgress": profile.cashBalance,
            "requiredMonthlyInvestment": ceil(max(max(profile.emergencyFundTarget, profile.monthlyExpenses * 6) - profile.cashBalance, 0) / 6),
            "feasibilityScore": min(96, round((surplus / max(profile.monthlyExpenses, 1)) * 60)),
            "timelineProjection": "6 months target",
            "explanation": "Emergency money protects you from job loss, medical costs, or sudden expenses.",
        },
        {
            "id": "goal-travel",
            "name": "Travel plan",
            "targetAmount": travel_target,
            "currentProgress": 0,
            "requiredMonthlyInvestment": ceil(travel_target / 12) if travel_target else 0,
            "feasibilityScore": min(95, round((surplus / max(ceil(travel_target / 12), 1)) * 70)) if travel_target else 70,
            "timelineProjection": "Yearly travel budget",
            "explanation": "Set a target amount and date so travel savings stay separate from higher-priority goals.",
        },
        {
            "id": "goal-house",
            "name": "House purchase",
            "targetAmount": profile.housePurchaseTarget,
            "currentProgress": profile.housePlan.downPayment,
            "requiredMonthlyInvestment": house_emi if profile.housePlan.mode == "emi" else ceil(max(profile.housePurchaseTarget - profile.housePlan.downPayment, 0) / 60),
            "feasibilityScore": max(20, min(95, round((surplus / max(house_emi or 1, 1)) * 70))) if profile.housePlan.mode == "emi" else 70,
            "timelineProjection": f"{profile.housePlan.tenureYears} year EMI" if profile.housePlan.mode == "emi" else "Save over 5 years",
            "explanation": "Compare saving first with taking a loan so the EMI does not weaken your monthly savings.",
            "planType": profile.housePlan.mode,
            "estimatedEmi": house_emi,
            "affordabilityWarning": emi_warning,
        },
        {
            "id": "goal-retirement",
            "name": "Retirement plan",
            "targetAmount": retirement_target,
            "currentProgress": worth,
            "requiredMonthlyInvestment": ceil(max(retirement_target - worth, 0) / max(retirement_years * 12, 1)),
            "feasibilityScore": min(95, max(25, round((surplus / max(ceil(max(retirement_target - worth, 0) / max(retirement_years * 12, 1)), 1)) * 70))),
            "timelineProjection": f"{retirement_years} years until retirement age",
            "explanation": "Retirement corpus is estimated from your chosen corpus or desired income using editable assumptions.",
        },
        {
            "id": "goal-freedom",
            "name": "Financial freedom",
            "targetAmount": freedom_target,
            "currentProgress": worth,
            "requiredMonthlyInvestment": ceil(max(freedom_target - worth, 0) / 180) if freedom_target else 0,
            "feasibilityScore": 65 if freedom_target else 50,
            "timelineProjection": "Long-term passive income goal",
            "explanation": f"Uses a {profile.withdrawalRate}% withdrawal-rate assumption to estimate the corpus needed.",
        },
    ]
    return goals


def allocation(profile: OnboardingProfile) -> list[dict]:
    colors = ["#2ac8b0", "#5fb0ff", "#f6c85f", "#f28b82", "#9b8cff", "#71d083", "#c7d2fe", "#f59e0b", "#34d399", "#a78bfa"]
    items = [
        ("Direct stocks", profile.stocksValue),
        ("Mutual funds", profile.mutualFundsValue),
        ("Crypto", profile.cryptoValue),
        ("Gold", profile.goldValue),
        ("EPF/PPF", profile.epfPpfValue),
        ("Real estate", profile.realEstateValue),
        ("Cash", profile.cashBalance),
    ]
    items.extend((item.type or "Other investment", item.value) for item in profile.additionalInvestments)
    return [{"name": name, "value": value, "color": colors[index % len(colors)]} for index, (name, value) in enumerate(items) if value > 0]


def build_dashboard(profile: OnboardingProfile) -> dict:
    profile.age = calculate_age(profile.dateOfBirth, profile.age)
    income = monthly_income(profile)
    profile.monthlyCashInflow = income
    worth = net_worth(profile)
    emi_total = total_emi_payments(profile)
    surplus = max(income - profile.monthlyExpenses - emi_total, 0)
    savings_rate = (surplus / income * 100) if income else 0
    risk_profile = "Higher growth comfort" if profile.volatilityComfort == "High" else "More stability preferred" if profile.volatilityComfort == "Low" else "Balanced growth"
    health = health_agent(profile)
    recommendations = recommendation_agent(profile)
    goals = goal_agent(profile, worth, surplus)
    market = research_agent(profile)
    behavior = behavior_agent(profile)

    return {
        "summary": {
            "netWorth": worth,
            "monthlyIncome": income,
            "monthlyExpenses": profile.monthlyExpenses,
            "savingsRate": savings_rate,
            "investableSurplus": surplus,
            "riskProfile": risk_profile,
            "age": profile.age,
        },
        "health": health,
        "allocation": allocation(profile),
        "projection": [{"month": f"Month {i + 1}", "value": round(worth * (1.008**i) + surplus * i)} for i in range(12)],
        "expenseCategories": [
            {"name": "Housing", "value": profile.rent},
            {"name": "EMI and loans", "value": emi_total},
            {"name": "Subscriptions", "value": profile.subscriptions},
            {"name": "Other spends", "value": max(profile.monthlyExpenses - profile.rent - profile.subscriptions, 0)},
        ],
        "alerts": [
            alert
            for alert in [
                "Your emergency fund needs attention before taking more risk." if health["emergencyFundMonths"] < 6 else "",
                "Your behavior answers show panic-selling risk. Smaller SIPs may help you stay invested." if behavior["panicSellingRisk"] == "High" else "",
            ]
            if alert
        ],
        "recommendations": recommendations,
        "goals": goals,
        "market": market,
        "behavior": behavior,
        "disclaimer": DISCLAIMER,
    }
