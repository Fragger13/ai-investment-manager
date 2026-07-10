/**
 * Mobile-side API types, mirrored from frontend/types.ts and
 * frontend/lib/api.ts. Only the shapes the mobile shell consumes are typed
 * strictly; the onboarding profile stays loose until the mobile onboarding
 * port (the backend treats it as an opaque encrypted payload anyway).
 */

// The full profile has ~60 fields owned by the web onboarding. The mobile
// shell only reads a few display fields and passes the rest through verbatim.
export type OnboardingProfile = {
  name?: string;
  age?: number;
  investableThisMonth?: number;
  monthlySalary?: number;
  [key: string]: unknown;
};

export type AuthResponse = {
  access_token: string;
  refresh_token?: string;
  name: string;
  email: string;
  onboarding_complete: boolean;
  email_verified: boolean;
};

export type VerificationStatus = {
  email: string;
  email_verified: boolean;
  sent: boolean;
  provider?: string;
  detail?: string;
};

export type ChatCard = {
  type: "metrics" | "recommendation" | "options";
  intro?: string;
  metrics?: { label: string; amount: number; icon?: string }[];
  title?: string;
  body?: string;
  icon?: string;
  tone?: "positive" | "warning" | "neutral";
  options?: { label: string; primary?: boolean }[];
};

export type ChatResponse = {
  reply: string;
  cards: ChatCard[];
  suggestions: string[];
  mood?: string;
};

export type Goal = {
  id: string;
  name: string;
  priority: number;
  targetAmount: number;
  currentProgress: number;
  requiredMonthlyInvestment: number;
  feasibilityScore: number;
  timelineProjection: string;
  explanation: string;
  planType: string;
  estimatedEmi: number;
  affordabilityWarning: string;
};

export type DashboardData = {
  summary: {
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    savingsRate: number;
    investableSurplus: number;
    riskProfile: string;
    age: number;
  };
  health: {
    score: number;
    explanation: string;
    whyItMatters: string;
    savingsRate: number;
    expenseBurden: number;
    debtBurden: number;
    emergencyFundMonths: number;
    netWorth: number;
    strengths: string[];
    weaknesses: string[];
    actions: string[];
  };
  allocation: { name: string; value: number; color: string }[];
  projection: { month: string; value: number }[];
  expenseCategories: { name: string; value: number }[];
  alerts: string[];
  recommendations: unknown[];
  goals: Goal[];
  market: {
    title: string;
    detail: string;
    whyItMatters: string;
    confidence: number;
    tone: "Opportunity" | "Warning" | "Neutral";
    sources: { title?: string; url?: string }[];
  }[];
  behavior: {
    spendingDiscipline: string;
    impulseSpendingRisk: string;
    panicSellingRisk: string;
    investmentDiscipline: string;
    suggestedNudges: string[];
  };
  disclaimer: string;
};
