from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator


class AddedInvestment(BaseModel):
    type: str = ""
    value: int = 0
    notes: str = ""


HOLDING_ASSET_CLASSES = {
    "stock", "mutualFund", "etf", "crypto", "gold", "silver",
    "realEstate", "bond", "nps", "fd", "cash", "epfPpf", "other",
}


class Holding(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = ""
    assetClass: str = Field(default="other", validation_alias=AliasChoices("assetClass", "asset_class"))
    name: str = ""
    symbol: str = ""
    schemeCode: str = Field(default="", validation_alias=AliasChoices("schemeCode", "scheme_code"))
    units: float = 0.0
    currentValue: float = Field(default=0.0, validation_alias=AliasChoices("currentValue", "current_value"))
    valueAtCost: float = Field(default=0.0, validation_alias=AliasChoices("valueAtCost", "value_at_cost"))
    hasSip: bool = Field(default=False, validation_alias=AliasChoices("hasSip", "has_sip"))
    sipAmount: float = Field(default=0.0, validation_alias=AliasChoices("sipAmount", "sip_amount"))
    source: str = "manual"
    lastPricedAt: str = Field(default="", validation_alias=AliasChoices("lastPricedAt", "last_priced_at"))

    @model_validator(mode="after")
    def normalize(self):
        if self.assetClass not in HOLDING_ASSET_CLASSES:
            self.assetClass = "other"
        if self.source not in {"manual", "upload", "live"}:
            self.source = "manual"
        return self


class EmiPlan(BaseModel):
    mode: Literal["lumpsum", "emi"] = "lumpsum"
    interestRate: float = 8.5
    tenureYears: int = 10
    downPayment: int = 0


class EmiLoan(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    productType: str = Field(default="", validation_alias=AliasChoices("productType", "product_type"))
    name: str = ""
    principalAmount: int = Field(default=0, validation_alias=AliasChoices("principalAmount", "principal_amount"))
    totalInterestAmount: int = Field(default=0, validation_alias=AliasChoices("totalInterestAmount", "total_interest_amount"))
    totalEmiAmount: int = Field(default=0, validation_alias=AliasChoices("totalEmiAmount", "total_emi_amount"))
    startDate: str = Field(default="", validation_alias=AliasChoices("startDate", "start_date"))
    endDate: str = Field(default="", validation_alias=AliasChoices("endDate", "end_date"))
    monthlyEmiAmount: int = Field(default=0, validation_alias=AliasChoices("monthlyEmiAmount", "monthly_emi_amount"))
    estimatedInterestRate: float = Field(default=0, validation_alias=AliasChoices("estimatedInterestRate", "estimated_interest_rate"))

    @model_validator(mode="after")
    def synchronize_calculated_fields(self):
        months = _months_between(self.startDate, self.endDate)
        if months > 0 and self.principalAmount > 0 and self.totalInterestAmount > 0:
            self.monthlyEmiAmount = round((self.principalAmount + self.totalInterestAmount) / months)
            self.estimatedInterestRate = round(self.totalInterestAmount / self.principalAmount / (months / 12) * 100, 2)
        if not self.totalEmiAmount and months > 0 and self.monthlyEmiAmount > 0:
            self.totalEmiAmount = int(self.monthlyEmiAmount * months)
        return self


class ProfileGoal(BaseModel):
    type: str = ""
    customName: str = ""
    priority: int = 1
    targetAmount: int = 0
    currentAmount: int = 0
    targetDate: str = ""
    paymentStyle: Literal["lumpsum", "emi"] = "lumpsum"
    interestRate: float = 8.5
    tenureYears: int = 5
    downPayment: int = 0
    monthlyContribution: int = 0
    internationalTrips: int = 0
    domesticTrips: int = 0
    internationalTripCost: int = 200000
    domesticTripCost: int = 60000
    retirementInputType: str = "corpus"
    desiredMonthlyIncome: int = 0
    desiredYearlyIncome: int = 0
    withdrawalRate: float = 4
    notes: str = ""
    linkedHoldingIds: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def preserve_legacy_travel_target(self):
        if self.type == "Travel" and not self.targetAmount:
            self.targetAmount = int((self.internationalTrips * self.internationalTripCost) + (self.domesticTrips * self.domesticTripCost))
        return self


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
    incomeStructureVersion: int = 1
    # Current-month investable override + payday timing (see intelligence.investable_surplus).
    investableThisMonth: int = 0
    investableThisMonthMonth: str = ""  # YYYY-MM the override applies to
    salaryDay: str = ""  # "Last working day" | "1st of the month" | "Variable"

    rent: int = 0
    emi: int = 0
    loans: int = 0
    hasEmiLoans: bool | None = None
    subscriptions: int = 0
    creditCardDebt: int = 0
    monthlyExpenses: int = 0
    emiLoans: list[EmiLoan] = Field(default_factory=list, validation_alias=AliasChoices("emiLoans", "emi_loans"))

    stocksValue: int = 0
    mutualFundsValue: int = 0
    cryptoValue: int = 0
    goldValue: int = 0
    epfPpfValue: int = 0
    epfPpfMonthly: int = 0
    realEstateValue: int = 0
    cashBalance: int = 0
    additionalInvestments: list[AddedInvestment] = Field(default_factory=list)
    holdings: list[Holding] = Field(default_factory=list)

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
    goals: list[ProfileGoal] = Field(default_factory=list)

    spendingDiscipline: str = ""
    emotionalSpendingTendency: str = ""
    investmentPsychology: str = ""
    riskReaction: str = ""
    tracksExpenses: str = ""
    investsMonthly: str = ""
    panicSellRisk: str = ""
    investingBlocker: str = ""

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_profile(cls, value):
        if not isinstance(value, dict):
            return value
        data = dict(value)
        if int(data.get("incomeStructureVersion") or 0) < 2:
            data["otherIncome"] = int(data.get("bonusIncome") or 0) + int(data.get("sideIncome") or 0) + int(data.get("otherIncome") or 0)
            data["bonusIncome"] = 0
            data["sideIncome"] = 0
            data["incomeStructureVersion"] = 2
        loans = data.get("emiLoans") or data.get("emi_loans") or []
        if not loans and int(data.get("emi") or 0) > 0:
            loans = [
                {
                    "productType": "Other",
                    "name": "Existing EMI or loan",
                    "principalAmount": int(data.get("loans") or 0),
                    "monthlyEmiAmount": int(data.get("emi") or 0),
                }
            ]
        data["emiLoans"] = loans
        return data

    @model_validator(mode="after")
    def synchronize_derived_fields(self):
        self.monthlyCashInflow = int(self.monthlySalary + self.otherIncome)
        if self.emiLoans:
            self.emi = sum(item.monthlyEmiAmount for item in self.emiLoans)
        if not self.volatilityComfort:
            self.volatilityComfort = self.shortTermVolatilityComfort
        if self.holdings:
            sums = {key: 0 for key in ("stock", "mutualFund", "etf", "crypto", "gold", "silver", "realEstate")}
            extras: list[AddedInvestment] = []
            extra_type_map = {"bond": "Bonds", "nps": "NPS", "fd": "Fixed deposits", "other": "Other"}
            for h in self.holdings:
                if h.assetClass in sums:
                    sums[h.assetClass] += int(h.currentValue or 0)
                elif h.assetClass in extra_type_map:
                    extras.append(AddedInvestment(type=extra_type_map[h.assetClass], value=int(h.currentValue or 0), notes=h.name))
            self.stocksValue = sums["stock"]
            self.mutualFundsValue = sums["mutualFund"] + sums["etf"]
            self.cryptoValue = sums["crypto"]
            self.goldValue = sums["gold"] + sums["silver"]
            self.realEstateValue = sums["realEstate"]
            self.additionalInvestments = extras
        return self


def _months_between(start_date: str, end_date: str) -> int:
    if not start_date or not end_date:
        return 0
    from datetime import date

    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
    except ValueError:
        return 0
    if end < start:
        return 0
    return (end.year - start.year) * 12 + end.month - start.month + 1


class ScenarioProjection(BaseModel):
    best: str
    base: str
    worst: str


class SourceLink(BaseModel):
    name: str
    url: str
    retrievedAt: str


class FundPick(BaseModel):
    name: str
    fundHouse: str = ""
    schemeCode: str = ""
    plan: str = "Direct - Growth"
    latestNav: float = 0.0
    navDate: str = ""
    return1y: float | None = None
    return3y: float | None = None
    return5y: float | None = None
    rankReturn: float | None = None
    rankBasis: str = ""


class Recommendation(BaseModel):
    id: str
    assetClass: str
    specificFunds: list[FundPick] = Field(default_factory=list)
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
    priority: int = 0
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


class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    profile: OnboardingProfile | None = None
    history: list[ChatTurn] = []


class ChatCard(BaseModel):
    type: str  # "metrics" | "recommendation" | "options"
    intro: str | None = None
    metrics: list[dict] | None = None  # [{label, amount, icon}]
    title: str | None = None
    body: str | None = None
    icon: str | None = None
    tone: str | None = None  # "positive" | "warning" | "neutral"
    options: list[dict] | None = None  # [{label, primary}]


class ChatResponse(BaseModel):
    reply: str
    cards: list[ChatCard] = []
    suggestions: list[str] = []
    mood: str = "warm"


class GoalEstimateRequest(BaseModel):
    goalType: str
    answers: dict[str, Any] = {}
    profile: OnboardingProfile | None = None


class GoalEstimateResponse(BaseModel):
    amount: int
    low: int
    high: int
    rationale: str
    assumptions: list[str] = []
    source: str = "calculator"  # "ai" | "calculator"


class GoalClarifyRequest(BaseModel):
    description: str
    profile: OnboardingProfile | None = None


class GoalClarifyOption(BaseModel):
    value: str
    label: str


class GoalClarifyQuestion(BaseModel):
    key: str
    prompt: str
    options: list[GoalClarifyOption] = []


class GoalClarifyResponse(BaseModel):
    questions: list[GoalClarifyQuestion] = []
