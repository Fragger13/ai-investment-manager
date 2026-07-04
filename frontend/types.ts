export type RiskLevel = "Low" | "Medium" | "High";

export type Investment = {
  type: string;
  value: number;
  notes?: string;
};

export type HoldingAssetClass =
  | "stock"
  | "mutualFund"
  | "etf"
  | "crypto"
  | "gold"
  | "silver"
  | "realEstate"
  | "bond"
  | "nps"
  | "fd"
  | "cash"
  | "epfPpf"
  | "other";

export type Holding = {
  id: string;
  assetClass: HoldingAssetClass;
  name: string;
  symbol?: string;
  schemeCode?: string;
  units?: number;
  currentValue: number;
  valueAtCost?: number;
  hasSip: boolean;
  sipAmount?: number;
  source: "manual" | "upload" | "live";
  lastPricedAt?: string;
};

export type EmiPlan = {
  mode: "lumpsum" | "emi";
  interestRate: number;
  tenureYears: number;
  downPayment: number;
};

export type GoalPaymentStyle = "lumpsum" | "emi";

export type EmiLoan = {
  productType: string;
  name: string;
  principalAmount: number;
  totalInterestAmount: number;
  totalEmiAmount?: number;
  startDate: string;
  endDate: string;
  monthlyEmiAmount: number;
  estimatedInterestRate: number;
};

export type ProfileGoal = {
  type: string;
  customName: string;
  priority: number;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  paymentStyle: GoalPaymentStyle;
  interestRate: number;
  tenureYears: number;
  downPayment: number;
  monthlyContribution: number;
  internationalTrips: number;
  domesticTrips: number;
  internationalTripCost: number;
  domesticTripCost: number;
  retirementInputType: string;
  desiredMonthlyIncome: number;
  desiredYearlyIncome: number;
  withdrawalRate: number;
  notes: string;
  linkedHoldingIds?: string[];
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
  incomeStructureVersion: number;
  investableThisMonth: number;
  investableThisMonthMonth: string;
  salaryDay: string;
  rent: number;
  emi: number;
  loans: number;
  hasEmiLoans: boolean | null;
  subscriptions: number;
  creditCardDebt: number;
  monthlyExpenses: number;
  emiLoans: EmiLoan[];
  stocksValue: number;
  mutualFundsValue: number;
  cryptoValue: number;
  goldValue: number;
  epfPpfValue: number;
  epfPpfMonthly: number;
  realEstateValue: number;
  cashBalance: number;
  additionalInvestments: Investment[];
  holdings: Holding[];
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
  goals: ProfileGoal[];
  spendingDiscipline: string;
  emotionalSpendingTendency: string;
  investmentPsychology: string;
  tracksExpenses: string;
  investsMonthly: string;
  panicSellRisk: string;
  investingBlocker: string;
};

export type SourceLink = {
  name: string;
  url: string;
  retrievedAt: string;
};

export type FundPick = {
  name: string;
  fundHouse: string;
  schemeCode: string;
  plan: string;
  latestNav: number;
  navDate: string;
  return1y: number | null;
  return3y: number | null;
  return5y: number | null;
  rankReturn: number | null;
  rankBasis: string;
};

export type Recommendation = {
  id: string;
  assetClass: string;
  specificFunds?: FundPick[];
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

export type RecommendationGoalImpact = {
  goalName: string;
  priority: number;
  impactPercent: number;
  direction: "positive" | "negative" | string;
  label: string;
  explanation: string;
};

export type FinancialCopilotAction = {
  priority: "High" | "Medium" | "Low" | string;
  actionType: "Invest" | "Reduce" | "Hold" | "Monitor" | "Research" | "Rebalance" | "Wait" | string;
  title: string;
  detail: string;
  amount: number;
  linkedGoal: string;
  source: string;
  entityId: string;
};

export type FinancialCopilotBrief = {
  greeting: string;
  intro: string;
  briefItems: {
    tone: "positive" | "warning" | "opportunity" | "market" | string;
    text: string;
  }[];
  recommendedAction: FinancialCopilotAction;
  priorityActions: FinancialCopilotAction[];
  emergingOpportunities: {
    assetName: string;
    ticker: string;
    assetType: string;
    opportunityType: string;
    confidenceScore: number;
    expectedReturn: string;
    riskLevel: string;
    supportingSignals: string[];
    linkedGoal: string;
    whyItMatters: string;
    action: string;
  }[];
  goalImpacts: Record<string, RecommendationGoalImpact[]>;
  portfolioDrift: {
    allocationDrift: number;
    concentrationScore: number;
    riskExposure: string;
    topAction: string;
    warnings: string[];
  };
  cashflowCoach: {
    title: string;
    action: string;
    amount: number;
    detail: string;
  };
  weeklyHealth: {
    score: number;
    trend: string;
    components: {
      label: string;
      score: number;
    }[];
    improvementSuggestions: string[];
  };
  generatedAt: string;
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
export type LlmEnhancementStatus = "not_requested" | "queued" | "processing" | "completed" | "failed" | "fallback";

export type MarketSignal = {
  id?: number;
  title: string;
  clean_headline?: string;
  cleanHeadline?: string;
  summary: string;
  signalType: string;
  signalClassification?: string;
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
  whyItMatters?: string;
  why_it_matters?: string;
  who_benefits?: string[];
  who_is_at_risk?: string[];
  user_relevance?: string;
  what_to_watch_next?: string;
  whatToWatchNext?: string;
  llm_enhanced?: boolean;
  llm_provider?: string;
  llm_model?: string;
  llm_generated_at?: string;
  llm_fallback_reason?: string | null;
  llmEnhanced?: boolean;
  llm_status?: LlmEnhancementStatus;
  llm_attempt_count?: number;
  llm_last_error?: string | null;
  llm_enhancement_status?: LlmEnhancementStatus;
  llm_enhancement_pending?: boolean;
  llmEnhancementStatus?: LlmEnhancementStatus;
  llmEnhancementPending?: boolean;
  signalCategory?: string;
  affectedAssets?: string[];
  likelyBeneficiaries?: string[];
  likelyLosers?: string[];
  relevantInstruments?: string[];
  shortTermImpact?: string;
  longTermImpact?: string;
  userRelevance?: number;
  portfolioRelevance?: number;
  impactScore?: number;
  historicalReliability?: number;
  signalStrength?: number;
  regimeRelevance?: number;
  contradictionScore?: number;
  validationNote?: string;
  sourceCount?: number;
  evidence?: MarketEvidenceItem[];
  conflictingEvidence?: MarketEvidenceItem[];
  relatedRecommendations?: string[];
  impactMap?: SignalImpactMap;
  explainability?: {
    whySignalMatters?: string;
    beneficiaryRationale?: string;
    loserRationale?: string;
    confidenceExplanation?: string;
    contradictionExplanation?: string;
    regimeDependence?: string;
    historicalReliability?: number;
  };
  confidenceBreakdown?: ConfidenceBreakdown;
  contradictionSummary?: string;
  uncertaintySummary?: string;
  cleanSummary?: {
    whatHappened?: string;
    whyItMatters?: string;
    whoBenefits?: string;
    whoSuffers?: string;
    doesItAffectMe?: string;
    whatToWatchNext?: string;
  };
};

export type ConfidenceBreakdown = {
  overall?: number;
  contradictionPenalty?: number;
  explanation?: string;
  components?: {
    label: string;
    score: number;
    tone?: "good" | "warn" | "danger" | "neutral" | string;
    explanation: string;
  }[];
};

export type MarketEvidenceItem = {
  sourceName: string;
  sourceUrl: string;
  summary: string;
  signalType?: string;
  credibilityScore?: number;
  relevanceScore?: number;
  relevance_score?: number;
  relationship_type?: string;
  confidenceContribution?: number;
  confidenceScore?: number;
  dataMode?: DataMode;
  retrievedAt: string;
};

export type SignalImpactMap = {
  id?: number;
  signalId?: number;
  signalClassification: string;
  affectedSectors: string[];
  affectedAssetClasses: string[];
  likelyBeneficiaries: string[];
  likelyLosers: string[];
  relevantInstruments: string[];
  shortTermImpact: string;
  longTermImpact: string;
  confidenceScore: number;
  evidenceLinks: MarketEvidenceItem[];
  contradictionLinks: MarketEvidenceItem[];
  relatedRecommendations: string[];
  portfolioRelevance: number;
  goalRelevance: number;
  risks?: string[];
  drivers?: string[];
  retrievedAt?: string;
};

export type MarketRegime = {
  id?: number;
  regimeName: string;
  confidenceScore: number;
  drivers: string[];
  supportingEvidence: MarketEvidenceItem[];
  contradictoryEvidence: MarketEvidenceItem[];
  recommendedPortfolioStance: string;
  summary: string;
  dataMode: DataMode;
  retrievedAt: string;
};

export type AssetIntelligence = {
  assetName: string;
  ticker: string;
  assetType: string;
  normalizedAssetClass?: string;
  sectorTheme?: string;
  category: string;
  summary: string;
  why_this_matters?: string;
  whyThisMatters?: string;
  why_now?: string;
  whyNow?: string;
  suitable_for?: string;
  suitableFor?: string;
  supporting_evidence?: string[];
  supportingEvidence?: string[];
  risks?: string[];
  data_points?: string[];
  dataPoints?: string[];
  invalidation_trigger?: string;
  invalidationTrigger?: string;
  llm_enhanced?: boolean;
  llm_provider?: string;
  llm_model?: string;
  llm_generated_at?: string;
  llm_fallback_reason?: string | null;
  llmEnhanced?: boolean;
  llm_status?: LlmEnhancementStatus;
  llm_attempt_count?: number;
  llm_last_error?: string | null;
  llm_enhancement_status?: LlmEnhancementStatus;
  llm_enhancement_pending?: boolean;
  llmEnhancementStatus?: LlmEnhancementStatus;
  llmEnhancementPending?: boolean;
  suitabilityNotes: string;
  riskNotes: string;
  evidence: MarketEvidenceItem[];
  evidenceCount: number;
  confidenceScore: number;
  dataMode: DataMode;
  retrievedAt: string;
  expectedReturn?: {
    label?: string;
    cagrRange?: string;
    expectedCagr?: number;
    conservative?: number;
    base?: number;
    aggressive?: number;
    assumptions?: string;
    disclaimer?: string;
  } | null;
  technical?: {
    latestPrice?: number | null;
    movingAverage20?: number | null;
    movingAverage50?: number | null;
    movingAverage200?: number | null;
    rsi?: number | null;
    macd?: number | null;
    volumeSpike: string;
    relativeStrength: number;
    volatility: number;
    supportZone: string;
    resistanceZone: string;
    breakoutStatus: string;
    trendStrength: number;
    drawdown?: number | null;
    buyRange: string;
    reviewZone: string;
    stopLossReference: string;
    confidenceScore: number;
    dataMode: DataMode;
    sourceUrl: string;
  } | null;
  fundamental?: {
    dataCompleteness: string;
    revenueGrowthTrend: string;
    profitGrowthTrend: string;
    marginTrend: string;
    debtLevel: string;
    roeRoce: string;
    valuationProxy: string;
    earningsMomentum: string;
    promoterHolding: string;
    institutionalHolding: string;
    sectorTailwindScore: number;
    recentNewsSentiment: string;
    corporateActionRisk: string;
    fundamentalScore: number;
    dataMode: DataMode;
  } | null;
  liquidity?: {
    marketCapTier: string;
    volumeScore: number;
    liquidityScore: number;
    minimumLiquidityPassed: boolean;
    liquidityNotes: string;
    dataMode: DataMode;
  } | null;
  risk?: {
    riskCategory: string;
    volatilityScore: number;
    drawdownScore: number;
    concentrationRisk: string;
    suitabilityRisk: string;
    riskNotes: string;
  } | null;
  alpha?: {
    bucket: string;
    nonObviousReason: string;
    keySignal: string;
    asymmetryScore: number;
    noveltyScore: number;
    evidenceScore: number;
    riskAdjustedScore: number;
    suggestedAction: string;
    allocationCap: number;
    invalidationTrigger: string;
    riskLabel: string;
  } | null;
  crypto?: {
    narrative: string;
    marketCapTier: string;
    liquidityScore: number;
    volatilityScore: number;
    narrativeStrength: number;
    evidenceScore: number;
    recommendedAction: string;
    allocationCap: number;
    riskWarning: string;
  } | null;
};

export type AlphaOpportunity = {
  assetName: string;
  ticker: string;
  assetType: string;
  expectedReturn?: {
    label?: string;
    cagrRange?: string;
    expectedCagr?: number;
  } | null;
  bucket: string;
  nonObviousReason: string;
  keySignal: string;
  supportingSignals: string[];
  conflictingSignals: string[];
  asymmetryScore: number;
  noveltyScore: number;
  evidenceScore: number;
  riskAdjustedScore: number;
  suggestedAction: string;
  allocationCap: number;
  invalidationTrigger: string;
  riskLabel: string;
  retrievedAt: string;
};

export type CryptoOpportunity = {
  assetName: string;
  symbol: string;
  narrative: string;
  marketCapTier: string;
  liquidityScore: number;
  volatilityScore: number;
  narrativeStrength: number;
  evidenceScore: number;
  recommendedAction: string;
  allocationCap: number;
  riskWarning: string;
  evidence: MarketEvidenceItem[];
  dataMode: DataMode;
  retrievedAt: string;
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

export type FundFactorInsights = {
  compositeScore?: number;
  sortino?: number | null;
  calmar?: number | null;
  maxDrawdown?: number | null;
  maxDrawdown3y?: number | null;
  downCapture?: number | null;
  alpha?: number | null;
  volatility?: number | null;
  sortinoPercentile?: number | null;
  drawdownPercentile?: number | null;
  historyYears?: number | null;
};

export type CommunitySentiment = {
  source?: string;
  /** "asset" = chatter about this specific instrument; "category" = overall
   *  forum mood (the robust fallback when the asset isn't being discussed). */
  scope?: "asset" | "category";
  mentionCount: number;
  sentiment: "positive" | "negative" | "mixed" | "neutral";
  sentimentScore?: number;
  bullishTerms?: string[];
  bearishTerms?: string[];
  subreddits?: string[];
  samplePosts?: { title: string; url: string; subreddit?: string }[];
  disclaimer?: string;
  asOf?: string;
};

export type GoalFundingStatus = {
  fundingPercent: number;
  requiredMonthlyInvestment: number;
  allocatedMonthlyInvestment: number;
  gap: number;
  onTrack: boolean;
  fix: string;
  timeHorizonMonths?: number;
};

export type GoalFundingPlan = {
  goals: {
    id: string;
    name: string;
    priority: number;
    essential: boolean;
    targetAmount: number;
    currentProgress: number;
    timeHorizonMonths: number;
    expectedReturn: number;
    requiredMonthlyInvestment: number;
    allocatedMonthlyInvestment: number;
    projectedCorpus: number;
    fundingPercent: number;
    gap: number;
    onTrack: boolean;
    fix: string;
  }[];
  surplus: number;
  totalRequired: number;
  totalAllocated: number;
  unallocatedSurplus?: number;
  fullyFundsAll: boolean;
  sipByGoalId?: Record<string, number>;
};

export type AdvancedRecommendation = {
  id: string;
  recommendationTitle: string;
  instrumentName: string;
  ticker: string;
  assetType: string;
  recommendationType: string;
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
  goalImpacts?: RecommendationGoalImpact[];
  goalImpactSummary?: string;
  linkedGoals: {
    priority: number;
    name: string;
    type: string;
    fundingGap: number;
    timeHorizonMonths: number;
    essential: boolean;
  }[];
  marketRegime: string;
  marketRegimeSummary: string;
  goalPriority: number;
  goalTimeHorizonMonths: number;
  goalFundingGap: number;
  essentialGoal: boolean;
  isFundPick?: boolean;
  factorScore?: number;
  factorDrivers?: string[];
  factorInsights?: FundFactorInsights;
  fundFactors?: Record<string, number | string | null>;
  diversification?: {
    correlationToHoldings?: number | null;
    diversifies?: boolean | null;
    redundant?: boolean;
  };
  goalFunding?: GoalFundingStatus;
  portfolioRole: string;
  portfolioConstruction: {
    currentAllocation?: Record<string, number>;
    targetAllocation?: Record<string, number>;
    riskBudget?: string;
    constructionNotes?: string[];
  };
  positionSizing: {
    note?: string;
    maxSinglePositionPercent?: number;
  };
  tacticalView: string;
  tacticalScore: number;
  timingPlan: Record<string, string>;
  accumulationStrategy: string;
  idealAccumulationZone: string;
  whyNow: string;
  expectedReturn?: {
    label?: string;
    cagrRange?: string;
    expectedCagr?: number;
    conservative?: number;
    base?: number;
    aggressive?: number;
    inflationAdjustedBase?: number;
    inflationAssumption?: number;
    assumptions?: string;
    disclaimer?: string;
  };
  buyRange: string;
  sellRange: string;
  tacticalHorizon: string;
  longTermHorizon: string;
  stopLossLogic: string;
  rebalanceLogic: string;
  reviewCadence: string;
  convictionScore: number;
  convictionLabel: string;
  convictionDrivers: string[];
  action: string;
  strategyBucket: string;
  assetName?: string;
  assetClass?: string;
  bucket?: string;
  strategyType?: string;
  suggestedAmount?: number;
  allocationPercent?: number;
  allocationCap?: number;
  expectedReturnRange?: string;
  expectedCagr?: string;
  expectedReturnConfidence?: string;
  rebalanceTrigger?: string;
  exitTrigger?: string;
  stopLossReference?: string;
  linkedGoalDetails?: {
    goalName: string;
    priority: number;
    timeline: string;
    fundingGapRelevance: string;
  }[];
  scores?: Record<string, number>;
  summary?: {
    whyThisMatters?: string;
    keyTrigger?: string;
    whyNow?: string;
    nonObviousInsight?: string;
  };
  thesis?: string[];
  risks?: {
    riskLevel?: string;
    downsideRisk?: string;
    volatilityRisk?: string;
    liquidityRisk?: string;
    concentrationRisk?: string;
    whatCanGoWrong?: string[];
    invalidationTrigger?: string;
  };
  evidence?: {
    sourceName?: string;
    sourceUrl?: string;
    timestamp: string;
    signalType: string;
    summary: string;
    credibilityScore: number;
    relevanceScore: number;
    recencyScore: number;
    confidenceContribution: number;
  }[];
  keyTrigger: string;
  whyThisMatters: string;
  thesisBullets: string[];
  riskBullets: string[];
  evidencePoints: {
    source: string;
    timestamp: string;
    signalType: string;
    confidence: number;
    summary: string;
  }[];
  evidenceScore: number;
  asymmetryScore: number;
  riskAdjustedScore: number;
  noveltyScore: number;
  fundamentalScore: number;
  technicalScore: number;
  strictAllocationCap: number;
  invalidationTrigger: string;
  fullResearchNotes: string[];
  finalScore: number;
  finalScoreBreakdown: Record<string, number | string>;
  qualityGateFailures: string[];
  sourceCount: number;
  modelVersion: string;
  pipelineVersion: string;
  scoringVersion: string;
  modelMetadata: Record<string, unknown>;
  candidate: Record<string, unknown>;
  assetIntelligence?: Record<string, unknown>;
  assetIntelligenceBacked?: boolean;
  investorCluster: Record<string, unknown>;
  factorScores: Record<string, number>;
  sentimentSignal: Record<string, unknown>;
  dynamicStockRank: Record<string, unknown>;
  relatedRecommendations: string[];
  knowledgeGraphNotes: string[];
  performance: Record<string, unknown>;
  historicalValidation?: StrategyValidation;
  strategyReliability?: Record<string, unknown>;
  validationAdjustment?: Record<string, unknown>;
  validation?: StrategyValidation;
  validationScore?: number;
  portfolioBucket?: string;
  portfolioBucketKey?: string;
  allocationImpact?: string;
  helpsDiversification?: boolean;
  concentrationRiskImpact?: string;
  portfolioOptimizationSummary?: Record<string, unknown>;
  recommendationKey?: string;
  versionNumber?: number;
  lastUpdated?: string;
  whyChanged?: string;
  changedFields?: {
    field: string;
    label: string;
    previous: unknown;
    current: unknown;
  }[];
  recommendationState?: "active" | "watchlist" | "archived" | string;
  lastResearchedAt: string;
  riskBudget: string;
  concentrationImpact: string;
  volatilityWarning: string;
  downsideScenario: string;
  institutionalRationale: string;
  recommendationReasoning?: {
    summary?: string;
    whyRecommended?: string;
    whyNow?: string;
    allocationRationale?: string;
    goalRationale?: string;
    portfolioRationale?: string;
    assumptions?: string[];
  };
  reasoningChain?: {
    step: string;
    status: "supportive" | "mixed" | "watch" | "limited" | string;
    detail: string;
  }[];
  evidenceSummary?: Record<string, unknown>;
  contradictionAnalysis?: {
    summary?: string;
    contradictionCount?: number;
    contradictionPenalty?: number;
    items?: {
      type: string;
      severity: string;
      summary: string;
      source?: string;
      sourceUrl?: string;
      confidence?: number;
    }[];
  };
  uncertaintyAnalysis?: {
    summary?: string;
    uncertaintyLevel?: string;
    items?: {
      type: string;
      severity: string;
      summary: string;
      actionImpact?: string;
    }[];
  };
  invalidationRules?: {
    type: string;
    trigger: string;
    severity: string;
    suggestedResponse: string;
  }[];
  confidenceBreakdown?: ConfidenceBreakdown;
  thesisValidation?: {
    thesisScore?: number;
    verdict?: string;
    summary?: string;
    assumptions?: string[];
  };
  explanationCards?: {
    title: string;
    summary: string;
    tone: "good" | "warn" | "danger" | "neutral" | string;
  }[];
  explanation_cards?: {
    question: string;
    answer: string;
    icon?: string;
    tone?: "good" | "warn" | "danger" | "neutral" | string;
  }[];
  advancedAnalysis?: string;
  advanced_analysis?: string;
  fullResearchSummary?: string;
  full_research_summary?: string;
  llm_enhanced?: boolean;
  llm_provider?: string;
  llm_model?: string;
  llm_generated_at?: string;
  llm_fallback_reason?: string | null;
  llmEnhanced?: boolean;
  llm_status?: LlmEnhancementStatus;
  llm_attempt_count?: number;
  llm_last_error?: string | null;
  llm_enhancement_status?: LlmEnhancementStatus;
  llm_enhancement_pending?: boolean;
  llmEnhancementStatus?: LlmEnhancementStatus;
  llmEnhancementPending?: boolean;
  trustLabels?: string[];
  explainabilityGeneratedAt?: string;
  importanceScore?: number;
  surfaceGroup?: "Top Recommendations" | "Tactical Opportunities" | "Watchlist" | "Risks To Review" | string;
  conciseReason?: string;
  conciseTrigger?: string;
  primaryRisk?: string;
  cardSummary?: {
    action?: string;
    asset?: string;
    expectedReturn?: string;
    allocation?: number;
    conviction?: number;
    topReason?: string;
    riskLevel?: string;
    linkedGoal?: string;
  };
  qualityWarnings?: string[];
  qualityAudit?: Record<string, unknown>;
  consensus?: {
    supportedLayers?: string[];
    agreementScore?: number;
    contradictionSeverity?: number;
    finalConviction?: number;
    finalEvidenceScore?: number;
    recommendationStrength?: string;
    summary?: string;
  };
  committeeSupport?: string[];
  intelligenceLayerSupport?: Record<string, unknown>;
  confidenceTier?: string;
  fusionNotes?: string[];
  disclaimer: string;
};

export type StrategyValidation = {
  strategyType?: string;
  historicalReliability?: number;
  historicalWinRate?: number;
  averageReturn?: number;
  medianReturn?: number;
  maxDrawdown?: number;
  downsideDeviation?: number;
  sharpeLike?: number;
  sampleSize?: number;
  validationPeriod?: string;
  holdingPeriodDays?: number;
  signalDecay?: number;
  setupQuality?: string;
  confidenceLabel?: string;
  downgradeReason?: string;
  actionAdjustment?: string;
  convictionAdjustment?: number;
  allocationMultiplier?: number;
  notes?: string[];
  disclaimer?: string;
  benchmarkComparison?: {
    benchmarkName?: string;
    benchmarkSymbol?: string;
    strategyAverageReturn?: number;
    benchmarkAverageReturn?: number;
    excessReturn?: number;
    benchmarkWinRate?: number;
    relativeQualityScore?: number;
    notes?: string;
  };
  regimePerformance?: {
    currentRegime?: string;
    currentRegimeReliability?: number;
    bestRegime?: string;
    weakestRegime?: string;
  };
};

export type StrategyBacktest = {
  id?: number;
  assetSymbol: string;
  assetName: string;
  assetType: string;
  strategyType: string;
  validationPeriod: string;
  sampleSize: number;
  winRate: number;
  averageReturn: number;
  medianReturn: number;
  volatility: number;
  maxDrawdown: number;
  downsideDeviation: number;
  sharpeLike: number;
  hitRate: number;
  signalDecay: number;
  holdingPeriodDays: number;
  qualityScore: number;
  confidenceInterval: string;
  bestRegime: string;
  weakestRegime: string;
  dataMode: DataMode;
  notes: string;
  retrievedAt: string;
};

export type SignalReliability = {
  id?: number;
  signalType: string;
  setupType?: string;
  assetClass: string;
  marketRegime: string;
  sampleSize: number;
  reliabilityScore: number;
  contradictionScore?: number;
  averageForwardReturn?: number;
  averageReturn?: number;
  hitRate?: number;
  signalDecay?: number;
  confidenceLabel: string;
  notes: string;
  retrievedAt: string;
};

export type PortfolioValidation = {
  id?: number;
  portfolioKey: string;
  recommendationCount: number;
  diversificationScore: number;
  concentrationScore: number;
  estimatedVolatility: number;
  estimatedMaxDrawdown: number;
  cryptoRiskContribution: number;
  tacticalRiskContribution: number;
  hiddenConcentrationNotes: string;
  validationSummary: string;
  retrievedAt: string;
};

export type PortfolioOptimizationSummary = {
  portfolioHealth: number;
  marketRegime: string;
  riskProfile: string;
  totalPortfolioValue: number;
  monthlySurplus: number;
  diversificationScore: number;
  concentrationScore: number;
  volatilityScore: number;
  goalAlignmentScore: number;
  allocationDrift: number;
  tacticalAllocationCap: number;
  cryptoAllocationCap: number;
  topRebalancingAction: string;
  riskExposure: string;
};

export type PortfolioAllocationPoint = {
  bucketKey: string;
  bucketName: string;
  percentage: number;
  value: number;
};

export type PortfolioTargetAllocation = {
  bucketKey: string;
  bucketName: string;
  targetPercentage: number;
  minPercentage: number;
  maxPercentage: number;
  expectedReturn: number;
  volatility: number;
  riskLevel: string;
  rationale: string;
};

export type PortfolioBucketAllocation = {
  bucketKey: string;
  bucketName: string;
  currentValue: number;
  currentPercentage: number;
  targetValue: number;
  targetPercentage: number;
  gapValue: number;
  gapPercentage: number;
  monthlyContribution: number;
  riskLevel: string;
  linkedGoals: {
    name?: string;
    type?: string;
    priority?: number;
    targetDate?: string;
  }[];
};

export type PortfolioRiskMetric = {
  metricName: string;
  score: number;
  severity: "low" | "medium" | "high" | string;
  explanation: string;
  recommendation: string;
};

export type PortfolioRebalancingSuggestion = {
  priority: number;
  action: string;
  bucketKey: string;
  title: string;
  explanation: string;
  monthlyAmount: number;
  driftPercentage: number;
  riskImpact: string;
  trigger: string;
};

export type PortfolioHolding = {
  id: string;
  name: string;
  category: string;
  allocationCategory?: string;
  value: number;
  valueAtCost?: number;
  source: "profile" | "action";
  monthlyContribution?: number;
  since?: string;
};

export type PortfolioInsight = {
  tone: "positive" | "warning" | "info";
  title: string;
  body: string;
};

export type PortfolioRecentAction = {
  id: number;
  actionType: string;
  entityType: string;
  entityName: string;
  amount: number;
  startDate: string;
  endDate: string;
  notes: string;
  createdAt: string;
};

export type PortfolioSummary = {
  netWorth: number;
  baseNetWorth?: number;
  actionContributedValue?: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyCommitments: number;
  investableSurplus: number;
  committedMonthly: number;
  holdings: PortfolioHolding[];
  allocation: { name: string; value: number; color: string }[];
  projection: { month: string; value: number }[];
  recentActions: PortfolioRecentAction[];
  insights: PortfolioInsight[];
  generatedAt: string;
};

export type PortfolioOptimization = {
  runId?: number;
  summary: PortfolioOptimizationSummary;
  currentAllocation: PortfolioAllocationPoint[];
  targetAllocation: PortfolioTargetAllocation[];
  bucketAllocations: PortfolioBucketAllocation[];
  riskMetrics: PortfolioRiskMetric[];
  rebalancingSuggestions: PortfolioRebalancingSuggestion[];
  monthlyDeploymentPlan: PortfolioBucketAllocation[];
  riskWarnings: string[];
  regimeAdjustments: string[];
  optimizationNotes: string[];
  retrievedAt: string;
};

export type MemoryEvent = {
  id: number;
  eventType: string;
  category: string;
  title: string;
  summary: string;
  entityType: string;
  entityId: string;
  severity: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type UserActionEvent = {
  id: number;
  actionType: string;
  entityType: string;
  entityId: string;
  entityName: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type DriftAlert = {
  id?: number;
  driftType: "portfolio" | "goal" | "behavior" | string;
  severity: "low" | "medium" | "high" | string;
  title: string;
  summary: string;
  metricName: string;
  currentValue: string;
  targetValue: string;
  recommendation: string;
  payload?: Record<string, unknown>;
  status: string;
  createdAt: string;
  priority?: "Critical" | "Important" | "Watchlist" | "Informational" | string;
  priorityScore?: number;
  surfaceProminently?: boolean;
};

export type RecommendationVersion = {
  id: number;
  recommendationKey: string;
  instrumentName: string;
  assetType: string;
  versionNumber: number;
  changeReason: string;
  changedFields: {
    field: string;
    label: string;
    previous: unknown;
    current: unknown;
  }[];
  marketRegime: string;
  convictionScore: number;
  confidenceScore: number;
  riskLevel: string;
  state: string;
  recommendation: Partial<AdvancedRecommendation>;
  createdAt: string;
};

export type ReassessmentLog = {
  id: number;
  recommendationKey: string;
  instrumentName: string;
  trigger: string;
  previousState: string;
  newState: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AdaptiveSummary = {
  memoryEventCount: number;
  recommendationVersionCount: number;
  userActionCount: number;
  openDriftAlertCount: number;
  latestEvent?: MemoryEvent | null;
  latestReassessment?: ReassessmentLog | null;
  learningNotes: string[];
};

export type MemoryTimeline = {
  events: MemoryEvent[];
  userActions: UserActionEvent[];
  reassessmentLogs: ReassessmentLog[];
  summary: AdaptiveSummary;
};

export type DriftResponse = {
  alerts: DriftAlert[];
  summary: Record<string, unknown>;
  bucketAllocations?: PortfolioBucketAllocation[];
  goals?: Record<string, unknown>[];
  behavior?: Record<string, unknown>;
};

export type RecommendationReassessment = {
  status: string;
  recommendations: AdvancedRecommendation[];
  logs: ReassessmentLog[];
  portfolioDrift: DriftResponse;
  summary: AdaptiveSummary;
};

export type ValidationRefresh = {
  status: string;
  assetsValidated: number;
  signalsValidated: number;
  portfolioValidated: boolean;
  averageReliability: number;
  weakSetups: number;
  regime: string;
  portfolio: PortfolioValidation;
};

export type AdvancedRecommendationResponse = {
  recommendations: AdvancedRecommendation[];
  signals: MarketSignal[];
  assets: AssetResearch[];
  dataMode: DataMode;
  lastResearchedAt: string;
  sourceCount: number;
  disclaimer: string;
  validationSummary?: Record<string, unknown>;
  investorCluster?: Record<string, unknown>;
  factorScores?: Record<string, number>;
  goalFunding?: GoalFundingPlan;
  recommendationGroups?: Record<string, {
    id?: string;
    instrumentName?: string;
    action?: string;
    riskLevel?: string;
    importanceScore?: number;
    reason?: string;
    linkedGoal?: string;
  }[]>;
  consolidationSummary?: Record<string, unknown>;
  cacheStatus?: string;
  orchestrationVersion?: string;
  finalOrchestration?: Record<string, unknown>;
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
