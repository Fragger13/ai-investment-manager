import { DashboardData, OnboardingProfile } from "@/types";

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
  rent: 0,
  emi: 0,
  loans: 0,
  subscriptions: 0,
  creditCardDebt: 0,
  monthlyExpenses: 0,
  stocksValue: 0,
  mutualFundsValue: 0,
  cryptoValue: 0,
  goldValue: 0,
  epfPpfValue: 0,
  realEstateValue: 0,
  cashBalance: 0,
  additionalInvestments: [],
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
  spendingDiscipline: "",
  emotionalSpendingTendency: "",
  investmentPsychology: "",
  riskReaction: "",
  tracksExpenses: "",
  investsMonthly: "",
  panicSellRisk: ""
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
  disclaimer: "This is educational decision support, not guaranteed financial advice. Investments involve market risk."
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
    monthlyCashInflow: (patch.monthlySalary ?? profile.monthlySalary) + (patch.bonusIncome ?? profile.bonusIncome) + (patch.sideIncome ?? profile.sideIncome) + (patch.otherIncome ?? profile.otherIncome)
  };
}
