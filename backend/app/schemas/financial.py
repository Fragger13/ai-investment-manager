from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AddedInvestment(BaseModel):
    type: str = ""
    value: int = 0
    notes: str = ""


class EmiPlan(BaseModel):
    mode: Literal["lumpsum", "emi"] = "lumpsum"
    interestRate: float = 8.5
    tenureYears: int = 10
    downPayment: int = 0


class OnboardingProfile(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str = ""
    dateOfBirth: str = ""
    age: int = 0
    occupation: str = ""
    city: str = ""
    maritalStatus: str = ""

    monthlySalary: int = 0
    bonusIncome: int = 0
    sideIncome: int = 0
    otherIncome: int = 0
    monthlyCashInflow: int = 0

    rent: int = 0
    emi: int = 0
    loans: int = 0
    subscriptions: int = 0
    creditCardDebt: int = 0
    monthlyExpenses: int = 0

    stocksValue: int = 0
    mutualFundsValue: int = 0
    cryptoValue: int = 0
    goldValue: int = 0
    epfPpfValue: int = 0
    realEstateValue: int = 0
    cashBalance: int = 0
    additionalInvestments: list[AddedInvestment] = Field(default_factory=list)

    shortTermLossTolerance: str = ""
    shortTermHorizon: str = ""
    shortTermVolatilityComfort: str = ""
    opportunityPreference: str = ""
    drawdownTolerance: str = ""
    volatilityComfort: str = ""
    liquidityRequirement: str = ""
    investmentHorizon: str = ""
    retirementAge: int = 60

    emergencyFundTarget: int = 0
    housePurchaseTarget: int = 0
    travelTarget: int = 0
    internationalTrips: int = 0
    domesticTrips: int = 0
    internationalTripCost: int = 200000
    domesticTripCost: int = 60000
    retirementTarget: int = 0
    retirementInputType: str = "corpus"
    retirementMonthlyIncome: int = 0
    retirementYearlyIncome: int = 0
    expectedInflation: float = 6
    lifeExpectancy: int = 85
    postRetirementReturn: float = 7
    financialFreedomTarget: int = 0
    financialFreedomInputType: str = "corpus"
    passiveMonthlyIncome: int = 0
    passiveYearlyIncome: int = 0
    withdrawalRate: float = 4
    housePlan: EmiPlan = Field(default_factory=EmiPlan)

    spendingDiscipline: str = ""
    emotionalSpendingTendency: str = ""
    investmentPsychology: str = ""
    riskReaction: str = ""
    tracksExpenses: str = ""
    investsMonthly: str = ""
    panicSellRisk: str = ""


class ScenarioProjection(BaseModel):
    best: str
    base: str
    worst: str


class SourceLink(BaseModel):
    name: str
    url: str
    retrievedAt: str


class Recommendation(BaseModel):
    id: str
    assetClass: str
    suggestedAllocation: int
    suggestedMonthlyAmount: int
    strategyType: str
    entryTiming: str
    exitTiming: str | None = None
    confidenceScore: int
    riskLevel: Literal["Low", "Medium", "High"]
    reasoning: str
    whatCanGoWrong: str = ""
    suitableFor: str = ""
    timeHorizon: str = ""
    reviewCondition: str = ""
    sourceLinks: list[SourceLink] = Field(default_factory=list)
    scenarioProjection: ScenarioProjection


class GoalProjection(BaseModel):
    id: str
    name: str
    targetAmount: int
    currentProgress: int
    requiredMonthlyInvestment: int
    feasibilityScore: int
    timelineProjection: str
    explanation: str = ""
    planType: str = "lumpsum"
    estimatedEmi: int = 0
    affordabilityWarning: str = ""


class DashboardResponse(BaseModel):
    summary: dict[str, Any]
    health: dict[str, Any]
    allocation: list[dict[str, Any]]
    projection: list[dict[str, Any]]
    expenseCategories: list[dict[str, Any]]
    alerts: list[str]
    recommendations: list[Recommendation]
    goals: list[GoalProjection]
    market: list[dict[str, Any]]
    behavior: dict[str, Any]
    disclaimer: str


class ChatRequest(BaseModel):
    message: str
    profile: OnboardingProfile | None = None


class ChatResponse(BaseModel):
    reply: str
