export type RiskLevel = "Low" | "Medium" | "High";

export type Investment = {
  type: string;
  value: number;
  notes?: string;
};

export type EmiPlan = {
  mode: "lumpsum" | "emi";
  interestRate: number;
  tenureYears: number;
  downPayment: number;
};

export type OnboardingProfile = {
  name: string;
  dateOfBirth: string;
  age: number;
  occupation: string;
  city: string;
  maritalStatus: string;
  monthlySalary: number;
  bonusIncome: number;
  sideIncome: number;
  otherIncome: number;
  monthlyCashInflow: number;
  rent: number;
  emi: number;
  loans: number;
  subscriptions: number;
  creditCardDebt: number;
  monthlyExpenses: number;
  stocksValue: number;
  mutualFundsValue: number;
  cryptoValue: number;
  goldValue: number;
  epfPpfValue: number;
  realEstateValue: number;
  cashBalance: number;
  additionalInvestments: Investment[];
  shortTermLossTolerance: string;
  shortTermHorizon: string;
  shortTermVolatilityComfort: string;
  opportunityPreference: string;
  drawdownTolerance: string;
  volatilityComfort: string;
  liquidityRequirement: string;
  investmentHorizon: string;
  retirementAge: number;
  emergencyFundTarget: number;
  housePurchaseTarget: number;
  travelTarget: number;
  internationalTrips: number;
  domesticTrips: number;
  internationalTripCost: number;
  domesticTripCost: number;
  retirementTarget: number;
  retirementInputType: string;
  retirementMonthlyIncome: number;
  retirementYearlyIncome: number;
  expectedInflation: number;
  lifeExpectancy: number;
  postRetirementReturn: number;
  financialFreedomTarget: number;
  financialFreedomInputType: string;
  passiveMonthlyIncome: number;
  passiveYearlyIncome: number;
  withdrawalRate: number;
  housePlan: EmiPlan;
  spendingDiscipline: string;
  emotionalSpendingTendency: string;
  investmentPsychology: string;
  riskReaction: string;
  tracksExpenses: string;
  investsMonthly: string;
  panicSellRisk: string;
};

export type SourceLink = {
  name: string;
  url: string;
  retrievedAt: string;
};

export type Recommendation = {
  id: string;
  assetClass: string;
  suggestedAllocation: number;
  suggestedMonthlyAmount: number;
  strategyType: string;
  entryTiming: string;
  exitTiming?: string;
  confidenceScore: number;
  riskLevel: RiskLevel;
  reasoning: string;
  whatCanGoWrong: string;
  suitableFor: string;
  timeHorizon: string;
  reviewCondition: string;
  sourceLinks: SourceLink[];
  scenarioProjection: {
    best: string;
    base: string;
    worst: string;
  };
};

export type Goal = {
  id: string;
  name: string;
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
  recommendations: Recommendation[];
  goals: Goal[];
  market: {
    title: string;
    detail: string;
    whyItMatters: string;
    confidence: number;
    tone: "Opportunity" | "Warning" | "Neutral";
    sources: SourceLink[];
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

export type ExtractedField = {
  field: keyof OnboardingProfile;
  label: string;
  value: number | string;
  confidence: number;
  status: string;
  explanation: string;
};

export type DocumentAnalysis = {
  id?: number;
  fileName: string;
  fileType: string;
  status: string;
  summary: {
    extractionStatus: string;
    confidence: number;
    detectedIncome: number;
    recurringExpenses: number;
    subscriptions: number;
    netWorthExtracted: number;
  };
  documents: { type: string; status: string; insight: string }[];
  extractedCategories: { name: string; value: number }[];
  extractedFields: ExtractedField[];
  profilePatch: Partial<OnboardingProfile>;
  aiFindings: string[];
};

export type DataMode = "live" | "delayed" | "cached" | "fallback" | "limited";

export type MarketSignal = {
  id?: number;
  title: string;
  summary: string;
  signalType: string;
  sentiment: string;
  assetClasses: string[];
  instruments: string[];
  sectors: string[];
  macroThemes: string[];
  riskSignals: string[];
  opportunitySignals: string[];
  relevanceScore: number;
  credibilityScore: number;
  confidenceScore: number;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  retrievedAt: string;
  dataMode: DataMode;
  relatedRecommendation?: string | null;
};

export type AssetResearch = {
  id?: number;
  instrumentName: string;
  assetType: string;
  category: string;
  summary: string;
  suitabilityNotes: string;
  riskNotes: string;
  evidence: { sourceName: string; sourceUrl: string; dataMode: DataMode }[];
  dataMode: DataMode;
  confidenceScore: number;
  retrievedAt: string;
};

export type ResearchSource = {
  id?: number;
  sourceName: string;
  sourceType: string;
  baseUrl: string;
  reliabilityScore: number;
  allowedIngestionMethod: string;
  refreshFrequency: string;
  categoriesCovered: string[];
  enabled: boolean;
  dataMode: DataMode;
};

export type AdvancedRecommendation = {
  id: string;
  recommendationTitle: string;
  instrumentName: string;
  assetType: string;
  suggestedMonthlyAmount: number;
  suggestedAllocationPercentage: number;
  priorityOrder: number;
  userSpecificReasoning: string;
  currentMarketReasoning: string;
  supportingSignals: MarketSignal[];
  contradictorySignals: MarketSignal[];
  riskExplanation: string;
  whatCanGoWrong: string;
  actionPlan: string[];
  entryApproach: string;
  reviewDate: string;
  exitOrRebalanceCondition: string;
  sourceLinks: {
    name: string;
    url: string;
    retrievedAt: string;
    dataMode: DataMode;
    supportType: string;
    credibilityScore: number;
  }[];
  dataTimestamp: string;
  dataMode: DataMode;
  confidenceScore: number;
  suitabilityScore: number;
  riskLevel: RiskLevel;
  timeHorizon: string;
  goalTag: string;
  disclaimer: string;
};

export type AdvancedRecommendationResponse = {
  recommendations: AdvancedRecommendation[];
  signals: MarketSignal[];
  assets: AssetResearch[];
  dataMode: DataMode;
  lastResearchedAt: string;
  sourceCount: number;
  disclaimer: string;
};

export type ResearchStatus = {
  status: string;
  dataMode: DataMode;
  latestRetrievedAt: string;
  latestSignalAt: string;
  latestArticleAt: string;
  sourceCount: number;
  signalCount: number;
  articleCount: number;
  assetCount: number;
  logs: {
    sourceName: string;
    status: string;
    mode: DataMode;
    message: string;
    retrievedAt: string;
    itemsProcessed: number;
  }[];
};
