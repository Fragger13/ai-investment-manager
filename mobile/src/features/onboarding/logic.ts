/**
 * Onboarding domain logic for the mobile flow.
 *
 * Every option VALUE here is copied verbatim from the web onboarding
 * (frontend/app/onboarding/_screens/*) — the recommendation engine keys off
 * these exact strings, so mobile and web must send identical values. Labels
 * and layout are free to differ; values are not.
 */

export type GoalDraft = {
  type: string;
  customName: string;
  priority: number;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  paymentStyle: "lumpsum" | "emi";
  interestRate: number;
  tenureYears: number;
  downPayment: number;
  monthlyContribution: number;
  retirementInputType: string;
  desiredMonthlyIncome: number;
  desiredYearlyIncome: number;
  withdrawalRate: number;
  notes: string;
};

export type LoanDraft = {
  productType: string;
  name: string;
  principalAmount: number;
  totalInterestAmount: number;
  totalEmiAmount: number;
  startDate: string;
  endDate: string;
  monthlyEmiAmount: number;
  estimatedInterestRate: number;
};

export type OnboardingDraft = {
  name: string;
  dateOfBirth: string;
  city: string;
  occupation: string;
  maritalStatus: string;
  monthlySalary: number;
  otherIncome: number;
  investableThisMonth: number;
  salaryDay: string;
  rent: number;
  monthlyExpenses: number;
  hasEmiLoans: boolean | null;
  emiLoans: LoanDraft[];
  drawdownTolerance: string;
  investmentHorizon: string;
  retirementAge: number;
  spendingDiscipline: string;
  emotionalSpendingTendency: string;
  tracksExpenses: string;
  investsMonthly: string;
  investingBlocker: string;
  goals: GoalDraft[];
  // Asset values a document upload can prefill (manual entry optional).
  stocksValue: number;
  mutualFundsValue: number;
  epfPpfValue: number;
  goldValue: number;
  cashBalance: number;
  subscriptions: number;
  // Detected EMI figure from uploaded documents. Not sent to the backend —
  // loans need real names and dates, so this only nudges the loans step.
  emiHint: number;
};

export function blankDraft(): OnboardingDraft {
  return {
    name: "",
    dateOfBirth: "",
    city: "",
    occupation: "",
    maritalStatus: "",
    monthlySalary: 0,
    otherIncome: 0,
    investableThisMonth: 0,
    salaryDay: "",
    rent: 0,
    monthlyExpenses: 0,
    hasEmiLoans: null,
    emiLoans: [],
    drawdownTolerance: "",
    investmentHorizon: "",
    retirementAge: 60,
    spendingDiscipline: "",
    emotionalSpendingTendency: "",
    tracksExpenses: "",
    investsMonthly: "",
    investingBlocker: "",
    goals: [],
    stocksValue: 0,
    mutualFundsValue: 0,
    epfPpfValue: 0,
    goldValue: 0,
    cashBalance: 0,
    subscriptions: 0,
    emiHint: 0,
  };
}

export function emptyGoal(type: string, priority: number): GoalDraft {
  return {
    type,
    customName: "",
    priority,
    targetAmount: 0,
    currentAmount: 0,
    targetDate: "",
    paymentStyle: "lumpsum",
    interestRate: 8.5,
    tenureYears: 5,
    downPayment: 0,
    monthlyContribution: 0,
    retirementInputType: "corpus",
    desiredMonthlyIncome: 0,
    desiredYearlyIncome: 0,
    withdrawalRate: 4,
    notes: "",
  };
}

export function emptyLoan(): LoanDraft {
  return {
    productType: "",
    name: "",
    principalAmount: 0,
    totalInterestAmount: 0,
    totalEmiAmount: 0,
    startDate: "",
    endDate: "",
    monthlyEmiAmount: 0,
    estimatedInterestRate: 0,
  };
}

// ---------------------------------------------------------------- options

export const FAMILY_OPTIONS = [
  { value: "Single", emoji: "🙂", helper: "Just you, for now" },
  { value: "Married", emoji: "💑", helper: "You and your partner" },
  { value: "Partnered", emoji: "🤝", helper: "Long term partner, not formally married" },
];

export const SALARY_DAY_OPTIONS = [
  { value: "Last working day", emoji: "📅", helper: "End of every month" },
  { value: "1st of the month", emoji: "🗓️", helper: "Start of every month" },
  { value: "Variable", emoji: "🔀", helper: "Not fixed or irregular" },
];

export const DRAWDOWN_QUESTION = {
  question: "Imagine you invested ₹10,000 and a few months later it became ₹9,000. What would you most likely do?",
  options: [
    { value: "0-10%", title: "Move my money somewhere safer", emoji: "🛡️" },
    { value: "10-25%", title: "Wait and see if it recovers", emoji: "🧘" },
    { value: "25%+", title: "Keep investing, it will grow over time", emoji: "🌱" },
  ],
};

export const HORIZON_QUESTION = {
  question: "How long can you leave this money invested without needing it?",
  options: [
    { value: "1-3 years", title: "1 to 3 years", emoji: "⚡" },
    { value: "3-5 years", title: "3 to 5 years", emoji: "🪴" },
    { value: "7-10 years", title: "7 to 10 years", emoji: "🌲" },
    { value: "10+ years", title: "10+ years", emoji: "🏔️" },
  ],
};

export const HABIT_QUESTIONS: {
  field: "spendingDiscipline" | "emotionalSpendingTendency" | "tracksExpenses" | "investsMonthly";
  question: string;
  options: { value: string; title: string; emoji: string }[];
}[] = [
  {
    field: "spendingDiscipline",
    question: "How well do you stick to a monthly budget?",
    options: [
      { value: "Low", title: "Often overspend", emoji: "🙈" },
      { value: "Medium", title: "Mixed", emoji: "🙂" },
      { value: "High", title: "Tight control", emoji: "💪" },
    ],
  },
  {
    field: "emotionalSpendingTendency",
    question: "Do shopping urges ever take over?",
    options: [
      { value: "Rarely", title: "Rarely", emoji: "🧘" },
      { value: "Sometimes", title: "Sometimes", emoji: "🛍️" },
      { value: "Often", title: "Often", emoji: "🎢" },
    ],
  },
  {
    field: "tracksExpenses",
    question: "Do you actually track where your money goes?",
    options: [
      { value: "Rarely", title: "Rarely", emoji: "📂" },
      { value: "Sometimes", title: "Sometimes", emoji: "📝" },
      { value: "Often", title: "Every month", emoji: "📊" },
    ],
  },
  {
    field: "investsMonthly",
    question: "Do you invest something every month?",
    options: [
      { value: "Rarely", title: "Rarely", emoji: "🌪️" },
      { value: "Sometimes", title: "Sometimes", emoji: "🌤️" },
      { value: "Often", title: "Regularly", emoji: "📆" },
    ],
  },
];

export const BLOCKER_QUESTION = {
  question: "What usually stops you from investing more?",
  note: "Pick all that apply",
  options: [
    { value: "Nothing right now", title: "Nothing right now", emoji: "🌈" },
    { value: "Irregular income", title: "Irregular income", emoji: "📉" },
    { value: "Fear of losses", title: "Fear of losses", emoji: "😨" },
    { value: "Unexpected expenses", title: "Surprise expenses", emoji: "🛠️" },
    { value: "I forget or delay", title: "I forget or delay", emoji: "🕒" },
    { value: "Too many choices", title: "Too many choices", emoji: "🤯" },
  ],
};

export const NO_BLOCKER = "Nothing right now";
export const MULTI_SEP = ", ";

export const GOAL_OPTIONS = [
  { value: "Retirement", label: "Retirement", emoji: "🏖️" },
  { value: "Financial freedom", label: "Financial freedom", emoji: "🕊️" },
  { value: "House purchase", label: "House", emoji: "🏠" },
  { value: "Car purchase", label: "Car", emoji: "🚗" },
  { value: "Child education", label: "Child education", emoji: "🎓" },
  { value: "Higher education", label: "Higher education", emoji: "📚" },
  { value: "Marriage", label: "Marriage", emoji: "💍" },
  { value: "Travel", label: "Travel", emoji: "✈️" },
  { value: "Debt repayment", label: "Pay off debt", emoji: "💳" },
  { value: "Business/startup", label: "Start a business", emoji: "🚀" },
  { value: "Other", label: "Something else", emoji: "✨" },
];

export const LOAN_TYPES = ["Home", "Vehicle", "Education", "Electronics", "Personal Loan", "Credit Card EMI", "Business Loan", "Other"];

// --------------------------------------------------- derived risk profile

// Same mappings the web applies (risk.tsx + onboarding page effect): the user
// answers two questions and the finer-grained engine inputs derive from them.
const DRAWDOWN_TO_LOSS: Record<string, string> = { "0-10%": "0-5%", "10-25%": "5-10%", "25%+": "10-15%" };
const DRAWDOWN_TO_OPPORTUNITY: Record<string, string> = {
  "0-10%": "Fewer high-confidence calls",
  "10-25%": "Balanced",
  "25%+": "Frequent opportunities",
};
const LOSS_TO_VOLATILITY: Record<string, string> = { "0-5%": "Low", "5-10%": "Low", "10-15%": "Moderate", "15%+": "High" };
const LOSS_TO_PSYCHOLOGY: Record<string, string> = {
  "0-5%": "Stable returns",
  "5-10%": "Stable returns",
  "10-15%": "Balanced",
  "15%+": "Higher growth with more ups and downs",
};
const DRAWDOWN_TO_PANIC: Record<string, string> = { "0-10%": "Often", "10-25%": "Sometimes", "25%+": "Rarely" };
const DEFAULT_SHORT_TERM_HORIZON = "6-12 months";

// ------------------------------------------------------------- helpers

export function ageFromDob(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(age, 0);
}

export function monthsBetween(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}

/** "1234567" → "12,34,567" (Indian digit grouping, input-friendly). */
export function formatINRInput(value: number): string {
  if (!value) return "";
  const digits = String(Math.round(value));
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

export function parseINRInput(text: string): number {
  const digits = text.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

// ------------------------------------------------------------ validation

export type StepId = "documents" | "about" | "income" | "spending" | "loans" | "risk" | "habits" | "goals" | "review";

export const STEP_ORDER: StepId[] = ["documents", "about", "income", "spending", "loans", "risk", "habits", "goals", "review"];

export function validateStep(step: StepId, draft: OnboardingDraft): string | null {
  switch (step) {
    case "documents":
      return null; // fully optional — typing everything by hand is fine
    case "about": {
      if (!draft.name.trim()) return "Tell Papa your name.";
      if (!draft.dateOfBirth) return "Pick your date of birth.";
      if (ageFromDob(draft.dateOfBirth) < 14) return "Papa needs a real date of birth.";
      if (!draft.city.trim()) return "Which city do you live in?";
      if (!draft.occupation.trim()) return "What do you do for a living?";
      if (!draft.maritalStatus) return "Pick your family status.";
      return null;
    }
    case "income": {
      if (draft.monthlySalary + draft.otherIncome <= 0) return "Enter at least one income source.";
      if (!draft.salaryDay) return "When does your salary usually arrive?";
      return null;
    }
    case "spending":
      return null; // rent and expenses may genuinely be 0
    case "loans": {
      if (draft.hasEmiLoans === null) return "Do you have any loans or EMIs?";
      if (draft.hasEmiLoans && draft.emiLoans.length === 0) return "Add your loan, or choose no loans for now.";
      return null;
    }
    case "risk": {
      if (!draft.drawdownTolerance) return "Answer the first question.";
      if (!draft.investmentHorizon) return "How long can your money stay invested?";
      if (!draft.retirementAge || draft.retirementAge < 30) return "Pick a retirement age (most people say 55 to 65).";
      return null;
    }
    case "habits": {
      for (const q of HABIT_QUESTIONS) {
        if (!draft[q.field]) return "Answer all four habit questions.";
      }
      if (!draft.investingBlocker) return "Pick what usually stops you (or say nothing right now).";
      return null;
    }
    case "goals": {
      if (draft.goals.length === 0) return "Pick at least one goal. Papa plans around them.";
      for (const goal of draft.goals) {
        if (goal.type === "Other" && !goal.customName.trim()) return "Give your custom goal a name.";
        if (goal.targetAmount <= 0) return `Set a target amount for ${goal.type === "Other" ? goal.customName || "your custom goal" : goal.type}.`;
      }
      return null;
    }
    case "review":
      return null;
  }
}

export function validLoan(loan: LoanDraft): boolean {
  return Boolean(
    loan.productType &&
      loan.name.trim() &&
      loan.monthlyEmiAmount > 0 &&
      loan.startDate &&
      loan.endDate &&
      loan.endDate >= loan.startDate
  );
}

// ------------------------------------------------------------- payload

/**
 * Assemble the exact profile object POST /onboarding expects, applying the
 * same derivations the web applies before submit. The backend re-derives
 * monthlyCashInflow/emi itself, but sending them keeps drafts readable.
 */
export function buildPayload(draft: OnboardingDraft): Record<string, unknown> {
  const loss = DRAWDOWN_TO_LOSS[draft.drawdownTolerance] || "";
  const volatility = LOSS_TO_VOLATILITY[loss] || "";
  const goals = draft.goals.map((goal, index) => ({ ...goal, priority: index + 1 }));
  return {
    name: draft.name.trim(),
    dateOfBirth: draft.dateOfBirth,
    age: ageFromDob(draft.dateOfBirth),
    occupation: draft.occupation.trim(),
    city: draft.city.trim(),
    maritalStatus: draft.maritalStatus,

    monthlySalary: draft.monthlySalary,
    otherIncome: draft.otherIncome,
    bonusIncome: 0,
    sideIncome: 0,
    monthlyCashInflow: draft.monthlySalary + draft.otherIncome,
    incomeStructureVersion: 2,
    investableThisMonth: draft.investableThisMonth,
    salaryDay: draft.salaryDay,

    rent: draft.rent,
    monthlyExpenses: draft.monthlyExpenses,
    subscriptions: draft.subscriptions,
    hasEmiLoans: draft.hasEmiLoans === true,
    emiLoans: draft.emiLoans,
    emi: draft.emiLoans.reduce((sum, loan) => sum + loan.monthlyEmiAmount, 0),
    loans: 0,
    creditCardDebt: 0,

    stocksValue: draft.stocksValue,
    mutualFundsValue: draft.mutualFundsValue,
    epfPpfValue: draft.epfPpfValue,
    goldValue: draft.goldValue,
    cashBalance: draft.cashBalance,

    drawdownTolerance: draft.drawdownTolerance,
    investmentHorizon: draft.investmentHorizon,
    retirementAge: draft.retirementAge,
    shortTermLossTolerance: loss,
    shortTermHorizon: DEFAULT_SHORT_TERM_HORIZON,
    shortTermVolatilityComfort: volatility,
    volatilityComfort: volatility,
    opportunityPreference: DRAWDOWN_TO_OPPORTUNITY[draft.drawdownTolerance] || "",
    investmentPsychology: LOSS_TO_PSYCHOLOGY[loss] || "",
    panicSellRisk: DRAWDOWN_TO_PANIC[draft.drawdownTolerance] || "",

    spendingDiscipline: draft.spendingDiscipline,
    emotionalSpendingTendency: draft.emotionalSpendingTendency,
    tracksExpenses: draft.tracksExpenses,
    investsMonthly: draft.investsMonthly,
    investingBlocker: draft.investingBlocker,

    goals,
  };
}

/**
 * Rebuild a draft from a previously saved profile (partial or complete) so a
 * user who started onboarding earlier resumes where they left off.
 */
export function draftFromProfile(profile: Record<string, unknown>): OnboardingDraft {
  const base = blankDraft();
  const num = (key: string) => Number(profile[key] || 0);
  const str = (key: string) => String(profile[key] || "");
  return {
    ...base,
    name: str("name"),
    dateOfBirth: str("dateOfBirth"),
    city: str("city"),
    occupation: str("occupation"),
    maritalStatus: str("maritalStatus"),
    monthlySalary: num("monthlySalary"),
    otherIncome: num("otherIncome"),
    investableThisMonth: num("investableThisMonth"),
    salaryDay: str("salaryDay"),
    rent: num("rent"),
    monthlyExpenses: num("monthlyExpenses"),
    hasEmiLoans: typeof profile.hasEmiLoans === "boolean" ? profile.hasEmiLoans : null,
    emiLoans: Array.isArray(profile.emiLoans) ? (profile.emiLoans as LoanDraft[]).map((l) => ({ ...emptyLoan(), ...l })) : [],
    drawdownTolerance: str("drawdownTolerance"),
    investmentHorizon: str("investmentHorizon"),
    retirementAge: num("retirementAge") || 60,
    spendingDiscipline: str("spendingDiscipline"),
    emotionalSpendingTendency: str("emotionalSpendingTendency"),
    tracksExpenses: str("tracksExpenses"),
    investsMonthly: str("investsMonthly"),
    investingBlocker: str("investingBlocker"),
    goals: Array.isArray(profile.goals)
      ? (profile.goals as Partial<GoalDraft>[]).map((g, i) => ({ ...emptyGoal(String(g.type || ""), i + 1), ...g }))
      : [],
    stocksValue: num("stocksValue"),
    mutualFundsValue: num("mutualFundsValue"),
    epfPpfValue: num("epfPpfValue"),
    goldValue: num("goldValue"),
    cashBalance: num("cashBalance"),
    subscriptions: num("subscriptions"),
  };
}
