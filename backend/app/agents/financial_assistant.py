from app.schemas.financial import OnboardingProfile
from app.agents.recommendation_action_agent import generate_advanced_recommendations
from app.services.intelligence import build_dashboard


def answer(message: str, profile: OnboardingProfile) -> str:
    dashboard = build_dashboard(profile)
    lower = message.lower()
    income = dashboard["summary"]["monthlyIncome"]
    expenses = dashboard["summary"]["monthlyExpenses"]
    surplus = dashboard["summary"]["investableSurplus"]
    savings_rate = dashboard["summary"]["savingsRate"]

    if "trip" in lower or "travel" in lower:
        travel_goal = next((goal for goal in dashboard["goals"] if goal["id"] == "goal-travel"), None)
        if not travel_goal or travel_goal["targetAmount"] <= 0:
            return "I need your travel assumptions first: number of domestic trips, international trips, and average cost per trip. Once entered, I can compare the yearly travel cost with your monthly surplus."
        affordable = travel_goal["requiredMonthlyInvestment"] <= surplus * 0.35
        return (
            f"Your yearly travel plan is about Rs {travel_goal['targetAmount']:,.0f}, or Rs {travel_goal['requiredMonthlyInvestment']:,.0f} per month. "
            f"Your current monthly surplus is Rs {surplus:,.0f}. "
            f"{'This looks affordable if other goals are already funded.' if affordable else 'This may stretch your budget, so reduce trip count or create a separate travel SIP.'}"
        )
    if "overspending" in lower or "spend" in lower or "expense" in lower:
        ratio = round(expenses / income * 100) if income else 0
        return (
            f"Your expenses are about {ratio}% of monthly inflow. A beginner-friendly target is to keep essential expenses and EMIs low enough that you can still save 20-30%. "
            f"Your current savings rate is {savings_rate:.1f}%. Start by reviewing subscriptions, lifestyle spends, and EMI commitments."
        )
    if "house" in lower or "emi" in lower:
        house = next((goal for goal in dashboard["goals"] if goal["id"] == "goal-house"), None)
        if not house:
            return "Enter a house target amount and choose either save-first or EMI mode. I will estimate monthly savings or EMI affordability."
        warning = f" Warning: {house['affordabilityWarning']}" if house.get("affordabilityWarning") else ""
        return (
            f"For the house goal, the estimated monthly requirement is Rs {house['requiredMonthlyInvestment']:,.0f}. "
            f"This should be compared with your monthly surplus of Rs {surplus:,.0f}.{warning}"
        )
    if "risk" in lower or "rebalance" in lower or "portfolio" in lower:
        allocation = ", ".join(f"{item['name']}: Rs {item['value']:,.0f}" for item in dashboard["allocation"][:5])
        return (
            f"Your main portfolio buckets are {allocation}. The system separates short-term risk comfort from long-term risk comfort. "
            "Use high-risk tactical ideas only after emergency money and core monthly investments are funded."
        )
    if "source" in lower or "why are you recommending" in lower or "prioritize" in lower or "sip or lump" in lower or "what can go wrong" in lower:
        advanced = generate_advanced_recommendations(profile)["recommendations"]
        top = sorted(advanced, key=lambda item: item["priorityOrder"])[0]
        sources = ", ".join(source["name"] for source in top["sourceLinks"]) or "fallback-labelled internal research layer"
        return (
            f"Highest-priority decision-support recommendation: {top['recommendationTitle']}. "
            f"Why it fits: {top['userSpecificReasoning']} Research reason: {top['currentMarketReasoning']} "
            f"Suggested entry: {top['entryApproach']} What can go wrong: {top['whatCanGoWrong']} "
            f"Sources used: {sources}. Data mode: {top['dataMode']}. This is not guaranteed financial advice."
        )
    rec = dashboard["recommendations"][0] if dashboard["recommendations"] else None
    if rec:
        return (
            f"Your investable surplus is about Rs {surplus:,.0f} per month. A suitable first action is: {rec['assetClass']} with about "
            f"Rs {rec['suggestedMonthlyAmount']:,.0f}/month. Reason: {rec['reasoning']} This is not guaranteed advice; verify before investing."
        )
    return "Complete onboarding first so I can use your actual income, expenses, goals, risk comfort, and portfolio."
