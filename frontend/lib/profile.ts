import { DashboardData, EmiLoan, Holding, HoldingAssetClass, Investment, OnboardingProfile } from "@/types";

// IST wall-clock month (YYYY-MM), matching the backend's stamp in
// save_onboarding / intelligence.current_ist_month. Used to decide whether the
// "invest this month" override still applies to the current month.
export function currentBudgetMonth(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 7);
}

export function monthlyCommitments(profile?: OnboardingProfile | null): number {
  if (!profile) return 0;
  // Keep in lockstep with backend intelligence.monthly_commitments():
  // rent + everyday expenses + subscriptions (legacy field) + EMIs.
  return Number(profile.rent || 0) + Number(profile.monthlyExpenses || 0) + Number(profile.subscriptions || 0) + totalMonthlyEmi(profile.emiLoans, profile.emi);
}

// The single source of truth for "what can I invest this month". Respects the
// user's explicit per-month override (investableThisMonth) when it applies to
// the current IST budget month; otherwise falls back to income − commitments.
// Used by the dashboard hero, the Plan (to size every action to this budget),
// and the Portfolio "available to invest" — so all three always agree.
export function availableToInvest(profile?: OnboardingProfile | null, monthlyIncome?: number, committedMonthly = 0): number {
  if (!profile) return 0;
  const overrideActive = Number(profile.investableThisMonth || 0) > 0 && profile.investableThisMonthMonth === currentBudgetMonth();
  const base = overrideActive
    ? Number(profile.investableThisMonth || 0)
    : Math.max(
        (monthlyIncome ?? (Number(profile.monthlyCashInflow || 0) || Number(profile.monthlySalary || 0) + Number(profile.otherIncome || 0)))
          - monthlyCommitments(profile),
        0,
      );
  // Money already committed to taken actions is no longer "available" this month.
  return Math.max(base - Math.max(committedMonthly, 0), 0);
}

export const blankProfile: OnboardingProfile = {
  name: "",
  dateOfBirth: "",
  age: 0,
  occupation: "",
  city: "",
  maritalStatus: "",
  monthlySalary: 0,
  bonusIncome: 0,
  sideIncome: 0,
  otherIncome: 0,
  monthlyCashInflow: 0,
  incomeStructureVersion: 2,
  investableThisMonth: 0,
  investableThisMonthMonth: "",
  salaryDay: "",
  rent: 0,
  emi: 0,
  loans: 0,
  hasEmiLoans: null,
  subscriptions: 0,
  creditCardDebt: 0,
  monthlyExpenses: 0,
  emiLoans: [],
  stocksValue: 0,
  mutualFundsValue: 0,
  cryptoValue: 0,
  goldValue: 0,
  epfPpfValue: 0,
  epfPpfMonthly: 0,
  realEstateValue: 0,
  cashBalance: 0,
  additionalInvestments: [],
  holdings: [],
  shortTermLossTolerance: "",
  shortTermHorizon: "",
  shortTermVolatilityComfort: "",
  opportunityPreference: "",
  drawdownTolerance: "",
  volatilityComfort: "",
  liquidityRequirement: "",
  investmentHorizon: "",
  retirementAge: 60,
  emergencyFundTarget: 0,
  housePurchaseTarget: 0,
  travelTarget: 0,
  internationalTrips: 0,
  domesticTrips: 0,
  internationalTripCost: 200000,
  domesticTripCost: 60000,
  retirementTarget: 0,
  retirementInputType: "corpus",
  retirementMonthlyIncome: 0,
  retirementYearlyIncome: 0,
  expectedInflation: 6,
  lifeExpectancy: 85,
  postRetirementReturn: 7,
  financialFreedomTarget: 0,
  financialFreedomInputType: "corpus",
  passiveMonthlyIncome: 0,
  passiveYearlyIncome: 0,
  withdrawalRate: 4,
  housePlan: {
    mode: "lumpsum",
    interestRate: 8.5,
    tenureYears: 10,
    downPayment: 0
  },
  goals: [],
  spendingDiscipline: "",
  emotionalSpendingTendency: "",
  investmentPsychology: "",
  tracksExpenses: "",
  investsMonthly: "",
  panicSellRisk: "",
  investingBlocker: ""
};

export const emptyDashboard: DashboardData = {
  summary: {
    netWorth: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    savingsRate: 0,
    investableSurplus: 0,
    riskProfile: "Complete onboarding",
    age: 0
  },
  health: {
    score: 0,
    explanation: "Complete onboarding to calculate your Financial Health Score.",
    whyItMatters: "This score helps you understand whether your money situation is stable enough for your goals.",
    savingsRate: 0,
    expenseBurden: 0,
    debtBurden: 0,
    emergencyFundMonths: 0,
    netWorth: 0,
    strengths: [],
    weaknesses: [],
    actions: []
  },
  allocation: [],
  projection: [],
  expenseCategories: [],
  alerts: [],
  recommendations: [],
  goals: [],
  market: [],
  behavior: {
    spendingDiscipline: "",
    impulseSpendingRisk: "",
    panicSellingRisk: "",
    investmentDiscipline: "",
    suggestedNudges: []
  },
  disclaimer: "This is educational decision support, not a promise of financial results. Investments involve market risk."
};

export function ageFromDob(dateOfBirth: string): number {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) age -= 1;
  return Math.max(age, 0);
}

export function mergeProfilePatch(profile: OnboardingProfile, patch: Partial<OnboardingProfile>): OnboardingProfile {
  return {
    ...profile,
    ...patch,
    monthlyCashInflow: (patch.monthlySalary ?? profile.monthlySalary) + (patch.otherIncome ?? profile.otherIncome)
  };
}

export function normalizeProfileForForm(profile?: OnboardingProfile | null): OnboardingProfile {
  if (!profile) return blankProfile;
  const legacyIncome = profile.incomeStructureVersion >= 2
    ? Number(profile.otherIncome || 0)
    : Number(profile.bonusIncome || 0) + Number(profile.sideIncome || 0) + Number(profile.otherIncome || 0);
  const emiLoans = profile.emiLoans?.length
    ? profile.emiLoans
    : profile.emi
      ? [legacyEmiLoan(profile.emi, profile.loans)]
      : [];
  const emi = totalMonthlyEmi(emiLoans, profile.emi);
  const goals = (profile.goals || []).map((goal) => (
    goal.type === "Travel" && !goal.targetAmount
      ? {
          ...goal,
          targetAmount: Number(goal.internationalTrips || 0) * Number(goal.internationalTripCost || 0)
            + Number(goal.domesticTrips || 0) * Number(goal.domesticTripCost || 0),
        }
      : goal
  ));
  const holdings = (profile.holdings && profile.holdings.length)
    ? profile.holdings
    : migrateLegacyHoldings(profile);
  return {
    ...blankProfile,
    ...profile,
    bonusIncome: 0,
    sideIncome: 0,
    otherIncome: legacyIncome,
    monthlyCashInflow: Number(profile.monthlySalary || 0) + legacyIncome,
    incomeStructureVersion: 2,
    emi,
    hasEmiLoans: profile.hasEmiLoans ?? (emiLoans.length ? true : null),
    emiLoans,
    goals,
    additionalInvestments: profile.additionalInvestments || [],
    holdings,
  };
}

const ADDED_TYPE_TO_ASSET_CLASS: Record<string, HoldingAssetClass> = {
  "Silver": "silver",
  "Bonds": "bond",
  "NPS": "nps",
  "Fixed deposits": "fd",
  "Recurring deposits": "fd",
  "SGB": "gold",
  "International stocks": "stock",
  "ETFs": "etf",
  "ESOPs": "stock",
  "RSUs": "stock",
  "Insurance-linked investments": "other",
  "Other": "other",
};

function migrateLegacyHoldings(profile: OnboardingProfile): Holding[] {
  const result: Holding[] = [];
  const push = (assetClass: HoldingAssetClass, name: string, currentValue: number) => {
    if (currentValue > 0) {
      result.push({
        id: `legacy-${assetClass}-${result.length}`,
        assetClass,
        name,
        currentValue,
        hasSip: false,
        source: "manual",
      });
    }
  };
  push("stock", "Direct stocks", Number(profile.stocksValue || 0));
  push("mutualFund", "Mutual funds", Number(profile.mutualFundsValue || 0));
  push("crypto", "Crypto", Number(profile.cryptoValue || 0));
  push("gold", "Gold", Number(profile.goldValue || 0));
  push("realEstate", "Real estate", Number(profile.realEstateValue || 0));
  (profile.additionalInvestments || []).forEach((inv: Investment, idx: number) => {
    if (!inv?.value) return;
    const assetClass = ADDED_TYPE_TO_ASSET_CLASS[inv.type] || "other";
    result.push({
      id: `legacy-extra-${idx}`,
      assetClass,
      name: inv.notes || inv.type || "Investment",
      currentValue: Number(inv.value || 0),
      hasSip: false,
      source: "manual",
    });
  });
  return result;
}

export function totalMonthlyEmi(emiLoans?: EmiLoan[], legacyEmi = 0): number {
  return emiLoans?.length ? emiLoans.reduce((sum, item) => sum + Number(item.monthlyEmiAmount || 0), 0) : Number(legacyEmi || 0);
}

function legacyEmiLoan(monthlyEmiAmount: number, principalAmount = 0): EmiLoan {
  return {
    productType: "Other",
    name: "Existing EMI or loan",
    principalAmount,
    totalInterestAmount: 0,
    totalEmiAmount: monthlyEmiAmount,
    startDate: "",
    endDate: "",
    monthlyEmiAmount,
    estimatedInterestRate: 0,
  };
}

export const behavioralProfileFields: (keyof OnboardingProfile)[] = [
  "spendingDiscipline",
  "emotionalSpendingTendency",
  "tracksExpenses",
  "investsMonthly",
  "investmentPsychology",
  "panicSellRisk",
  "investingBlocker"
];

export function hasBehavioralProfile(profile?: OnboardingProfile | null): boolean {
  if (!profile) return false;
  return behavioralProfileFields.every((field) => String(profile[field] || "").trim().length > 0);
}

export function profileCompletionPercent(profile?: OnboardingProfile | null): number {
  if (!profile) return 0;
  const checks: boolean[] = [
    Boolean(profile.name),
    Boolean(profile.dateOfBirth) && profile.age > 0,
    Boolean(profile.occupation),
    Boolean(profile.city),
    Boolean(profile.maritalStatus),
    Number(profile.monthlySalary || 0) > 0,
    Number(profile.monthlyExpenses || 0) > 0,
    Boolean(profile.shortTermLossTolerance),
    Boolean(profile.shortTermHorizon),
    Boolean(profile.drawdownTolerance),
    Boolean(profile.investmentHorizon),
    Boolean(profile.opportunityPreference),
    Number(profile.retirementAge || 0) > 0,
    Boolean(profile.spendingDiscipline),
    Boolean(profile.emotionalSpendingTendency),
    Boolean(profile.tracksExpenses),
    Boolean(profile.investsMonthly),
    Boolean(profile.investingBlocker),
    (profile.goals?.length || 0) > 0
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

export function isOnboardingComplete(profile?: OnboardingProfile | null): boolean {
  if (!profile) return false;
  const hasPersonalDetails = Boolean(profile.name && profile.dateOfBirth && profile.age > 0 && profile.occupation && profile.city && profile.maritalStatus);
  const hasIncome = Number(profile.monthlyCashInflow || profile.monthlySalary + profile.otherIncome) > 0;
  const hasShortTermRisk = Boolean(profile.shortTermLossTolerance && profile.shortTermHorizon && profile.shortTermVolatilityComfort && profile.opportunityPreference);
  const hasLongTermRisk = Boolean(profile.drawdownTolerance && profile.investmentHorizon && profile.retirementAge);
  const hasGoalSettings = Boolean(profile.goals?.length || (profile.retirementInputType && profile.financialFreedomInputType && profile.housePlan?.mode));
  return hasPersonalDetails && hasIncome && hasShortTermRisk && hasLongTermRisk && hasGoalSettings && hasBehavioralProfile(profile);
}
