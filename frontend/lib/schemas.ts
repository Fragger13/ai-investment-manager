import { z } from "zod";

const numeric = z.coerce.number().min(0);

const holdingAssetClass = z.enum([
  "stock", "mutualFund", "etf", "crypto", "gold", "silver",
  "realEstate", "bond", "nps", "fd", "cash", "epfPpf", "other",
]);

const holdingSchema = z.object({
  id: z.string().min(1),
  assetClass: holdingAssetClass,
  name: z.string().min(1, "Enter a name."),
  symbol: z.string().optional().default(""),
  schemeCode: z.string().optional().default(""),
  units: z.coerce.number().min(0).optional().default(0),
  currentValue: z.coerce.number().min(0),
  valueAtCost: z.coerce.number().min(0).optional().default(0),
  hasSip: z.boolean().default(false),
  sipAmount: z.coerce.number().min(0).optional().default(0),
  source: z.enum(["manual", "upload", "live"]).default("manual"),
  lastPricedAt: z.string().optional().default(""),
});

const emiLoanSchema = z.object({
  productType: z.string().min(1),
  name: z.string().min(1),
  principalAmount: numeric.optional().default(0),
  totalInterestAmount: numeric.optional().default(0),
  totalEmiAmount: numeric.optional().default(0),
  startDate: z.string().min(1, "Choose the loan start date."),
  endDate: z.string().min(1, "Choose the loan end date."),
  monthlyEmiAmount: z.coerce.number().positive("Enter the monthly EMI amount."),
  estimatedInterestRate: numeric.optional().default(0),
}).superRefine((loan, context) => {
  if (loan.startDate && loan.endDate && new Date(loan.endDate) < new Date(loan.startDate)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be on or after the start date." });
  }
});
const profileGoalSchema = z.object({
  type: z.string().min(1),
  customName: z.string().optional().default(""),
  priority: z.coerce.number().min(1),
  targetAmount: numeric,
  currentAmount: numeric,
  targetDate: z.string().optional().default(""),
  paymentStyle: z.enum(["lumpsum", "emi"]),
  interestRate: numeric,
  tenureYears: z.coerce.number().min(1).max(40),
  downPayment: numeric,
  monthlyContribution: numeric,
  internationalTrips: numeric,
  domesticTrips: numeric,
  internationalTripCost: numeric,
  domesticTripCost: numeric,
  retirementInputType: z.string().min(1),
  desiredMonthlyIncome: numeric,
  desiredYearlyIncome: numeric,
  withdrawalRate: numeric,
  notes: z.string().optional().default("")
}).superRefine((goal, context) => {
  if (goal.type === "Other" && !goal.customName.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["customName"], message: "Custom goal name is required." });
  }
});

export const onboardingSchema = z.object({
  name: z.string().min(2),
  dateOfBirth: z.string().min(8),
  age: z.coerce.number().min(1),
  occupation: z.string().min(2),
  city: z.string().min(2),
  maritalStatus: z.string().min(1),
  monthlySalary: numeric,
  bonusIncome: numeric,
  sideIncome: numeric,
  otherIncome: numeric,
  monthlyCashInflow: numeric,
  incomeStructureVersion: z.coerce.number().default(2),
  rent: numeric,
  emi: numeric,
  loans: numeric,
  hasEmiLoans: z.boolean().nullable().optional().default(null),
  subscriptions: numeric,
  creditCardDebt: numeric,
  monthlyExpenses: numeric,
  emiLoans: z.array(emiLoanSchema),
  stocksValue: numeric,
  mutualFundsValue: numeric,
  cryptoValue: numeric,
  goldValue: numeric,
  epfPpfValue: numeric,
  epfPpfMonthly: numeric,
  realEstateValue: numeric,
  cashBalance: numeric,
  additionalInvestments: z.array(z.object({ type: z.string(), value: numeric, notes: z.string().optional() })),
  holdings: z.array(holdingSchema).default([]),
  shortTermLossTolerance: z.string().min(1),
  shortTermHorizon: z.string().min(1),
  shortTermVolatilityComfort: z.string().min(1),
  opportunityPreference: z.string().min(1),
  drawdownTolerance: z.string().min(1),
  volatilityComfort: z.string().optional().default(""),
  liquidityRequirement: z.string().optional().default(""),
  investmentHorizon: z.string().min(1),
  retirementAge: z.coerce.number().min(40).max(80),
  emergencyFundTarget: numeric,
  housePurchaseTarget: numeric,
  travelTarget: numeric,
  internationalTrips: numeric,
  domesticTrips: numeric,
  internationalTripCost: numeric,
  domesticTripCost: numeric,
  retirementTarget: numeric,
  retirementInputType: z.string().min(1),
  retirementMonthlyIncome: numeric,
  retirementYearlyIncome: numeric,
  expectedInflation: numeric,
  lifeExpectancy: z.coerce.number().min(60).max(110),
  postRetirementReturn: numeric,
  financialFreedomTarget: numeric,
  financialFreedomInputType: z.string().min(1),
  passiveMonthlyIncome: numeric,
  passiveYearlyIncome: numeric,
  withdrawalRate: numeric,
  housePlan: z.object({
    mode: z.enum(["lumpsum", "emi"]),
    interestRate: numeric,
    tenureYears: z.coerce.number().min(1).max(30),
    downPayment: numeric
  }),
  goals: z.array(profileGoalSchema).min(1),
  spendingDiscipline: z.string().min(1),
  emotionalSpendingTendency: z.string().min(1),
  investmentPsychology: z.string().min(1),
  riskReaction: z.string().min(1),
  tracksExpenses: z.string().min(1),
  investsMonthly: z.string().min(1),
  panicSellRisk: z.string().min(1),
  investingBlocker: z.string().min(1)
});
