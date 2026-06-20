from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.financial import OnboardingProfile


DataMode = Literal["live", "delayed", "cached", "fallback", "limited"]


class ResearchSourceResponse(BaseModel):
    id: int | None = None
    sourceName: str
    sourceType: str
    baseUrl: str
    reliabilityScore: int
    allowedIngestionMethod: str
    refreshFrequency: str
    categoriesCovered: list[str]
    enabled: bool
    dataMode: DataMode = "fallback"


class MarketSignalResponse(BaseModel):
    id: int | None = None
    title: str
    summary: str
    signalType: str
    sentiment: str
    assetClasses: list[str] = Field(default_factory=list)
    instruments: list[str] = Field(default_factory=list)
    sectors: list[str] = Field(default_factory=list)
    macroThemes: list[str] = Field(default_factory=list)
    riskSignals: list[str] = Field(default_factory=list)
    opportunitySignals: list[str] = Field(default_factory=list)
    relevanceScore: int
    credibilityScore: int
    confidenceScore: int
    sourceName: str
    sourceUrl: str
    publishedAt: str = ""
    retrievedAt: str
    dataMode: DataMode = "fallback"
    relatedRecommendation: str | None = None
    signalCategory: str = ""
    affectedAssets: list[str] = Field(default_factory=list)
    likelyBeneficiaries: list[str] = Field(default_factory=list)
    likelyLosers: list[str] = Field(default_factory=list)
    whyItMatters: str = ""
    userRelevance: int = 0
    portfolioRelevance: int = 0
    impactScore: int = 0
    historicalReliability: int = 0
    signalStrength: int = 0
    regimeRelevance: int = 0
    contradictionScore: int = 0
    validationNote: str = ""
    sourceCount: int = 1
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    explainability: dict[str, Any] = Field(default_factory=dict)
    confidenceBreakdown: dict[str, Any] = Field(default_factory=dict)
    contradictionSummary: str = ""
    uncertaintySummary: str = ""
    cleanSummary: dict[str, Any] = Field(default_factory=dict)


class AssetResearchResponse(BaseModel):
    id: int | None = None
    instrumentName: str
    assetType: str
    category: str
    summary: str
    suitabilityNotes: str
    riskNotes: str
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    dataMode: DataMode
    confidenceScore: int
    retrievedAt: str


class AdvancedRecommendation(BaseModel):
    id: str
    recommendationTitle: str
    instrumentName: str
    ticker: str = ""
    assetType: str
    recommendationType: str = ""
    suggestedMonthlyAmount: int
    suggestedAllocationPercentage: int
    priorityOrder: int
    userSpecificReasoning: str
    currentMarketReasoning: str
    supportingSignals: list[MarketSignalResponse] = Field(default_factory=list)
    contradictorySignals: list[MarketSignalResponse] = Field(default_factory=list)
    riskExplanation: str
    whatCanGoWrong: str
    actionPlan: list[str]
    entryApproach: str
    reviewDate: str
    exitOrRebalanceCondition: str
    sourceLinks: list[dict[str, Any]]
    dataTimestamp: str
    dataMode: DataMode
    confidenceScore: int
    suitabilityScore: int
    riskLevel: Literal["Low", "Medium", "High"]
    timeHorizon: str
    goalTag: str
    linkedGoals: list[dict[str, Any]] = Field(default_factory=list)
    goalImpacts: list[dict[str, Any]] = Field(default_factory=list)
    goalImpactSummary: str = ""
    marketRegime: str = ""
    marketRegimeSummary: str = ""
    goalPriority: int = 0
    goalTimeHorizonMonths: int = 0
    goalFundingGap: int = 0
    essentialGoal: bool = False
    portfolioRole: str = ""
    portfolioBucket: str = ""
    portfolioBucketKey: str = ""
    allocationImpact: str = ""
    helpsDiversification: bool = False
    concentrationRiskImpact: str = ""
    portfolioOptimizationSummary: dict[str, Any] = Field(default_factory=dict)
    recommendationKey: str = ""
    versionNumber: int = 1
    lastUpdated: str = ""
    whyChanged: str = ""
    changedFields: list[dict[str, Any]] = Field(default_factory=list)
    recommendationState: str = "active"
    portfolioConstruction: dict[str, Any] = Field(default_factory=dict)
    positionSizing: dict[str, Any] = Field(default_factory=dict)
    tacticalView: str = ""
    tacticalScore: int = 0
    timingPlan: dict[str, Any] = Field(default_factory=dict)
    accumulationStrategy: str = ""
    idealAccumulationZone: str = ""
    whyNow: str = ""
    expectedReturn: dict[str, Any] = Field(default_factory=dict)
    buyRange: str = ""
    sellRange: str = ""
    tacticalHorizon: str = ""
    longTermHorizon: str = ""
    stopLossLogic: str = ""
    rebalanceLogic: str = ""
    reviewCadence: str = ""
    convictionScore: int = 0
    convictionLabel: str = ""
    convictionDrivers: list[str] = Field(default_factory=list)
    action: str = ""
    strategyBucket: str = ""
    assetName: str = ""
    assetClass: str = ""
    bucket: str = ""
    strategyType: str = ""
    suggestedAmount: int = 0
    allocationPercent: int = 0
    allocationCap: int = 0
    expectedReturnRange: str = ""
    expectedCagr: str = ""
    expectedReturnConfidence: str = ""
    rebalanceTrigger: str = ""
    exitTrigger: str = ""
    stopLossReference: str = ""
    linkedGoalDetails: list[dict[str, Any]] = Field(default_factory=list)
    scores: dict[str, Any] = Field(default_factory=dict)
    summary: dict[str, Any] = Field(default_factory=dict)
    thesis: list[str] = Field(default_factory=list)
    supportingSignalSummaries: list[str] = Field(default_factory=list)
    conflictingSignalSummaries: list[str] = Field(default_factory=list)
    risks: dict[str, Any] = Field(default_factory=dict)
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    keyTrigger: str = ""
    whyThisMatters: str = ""
    thesisBullets: list[str] = Field(default_factory=list)
    riskBullets: list[str] = Field(default_factory=list)
    evidencePoints: list[dict[str, Any]] = Field(default_factory=list)
    evidenceScore: int = 0
    validationScore: int = 0
    asymmetryScore: int = 0
    riskAdjustedScore: int = 0
    noveltyScore: int = 0
    fundamentalScore: int = 0
    technicalScore: int = 0
    strictAllocationCap: int = 0
    invalidationTrigger: str = ""
    fullResearchNotes: list[str] = Field(default_factory=list)
    finalScore: int = 0
    finalScoreBreakdown: dict[str, Any] = Field(default_factory=dict)
    qualityGateFailures: list[str] = Field(default_factory=list)
    historicalValidation: dict[str, Any] = Field(default_factory=dict)
    strategyReliability: dict[str, Any] = Field(default_factory=dict)
    validationAdjustment: dict[str, Any] = Field(default_factory=dict)
    validation: dict[str, Any] = Field(default_factory=dict)
    sourceCount: int = 0
    modelVersion: str = ""
    pipelineVersion: str = ""
    scoringVersion: str = ""
    modelMetadata: dict[str, Any] = Field(default_factory=dict)
    candidate: dict[str, Any] = Field(default_factory=dict)
    assetIntelligence: dict[str, Any] = Field(default_factory=dict)
    assetIntelligenceBacked: bool = False
    investorCluster: dict[str, Any] = Field(default_factory=dict)
    factorScores: dict[str, Any] = Field(default_factory=dict)
    sentimentSignal: dict[str, Any] = Field(default_factory=dict)
    dynamicStockRank: dict[str, Any] = Field(default_factory=dict)
    relatedRecommendations: list[str] = Field(default_factory=list)
    knowledgeGraphNotes: list[str] = Field(default_factory=list)
    performance: dict[str, Any] = Field(default_factory=dict)
    lastResearchedAt: str = ""
    riskBudget: str = ""
    concentrationImpact: str = ""
    volatilityWarning: str = ""
    downsideScenario: str = ""
    institutionalRationale: str = ""
    recommendationReasoning: dict[str, Any] = Field(default_factory=dict)
    reasoningChain: list[dict[str, Any]] = Field(default_factory=list)
    evidenceSummary: dict[str, Any] = Field(default_factory=dict)
    contradictionAnalysis: dict[str, Any] = Field(default_factory=dict)
    uncertaintyAnalysis: dict[str, Any] = Field(default_factory=dict)
    invalidationRules: list[dict[str, Any]] = Field(default_factory=list)
    confidenceBreakdown: dict[str, Any] = Field(default_factory=dict)
    thesisValidation: dict[str, Any] = Field(default_factory=dict)
    explanationCards: list[dict[str, Any]] = Field(default_factory=list)
    explanation_cards: list[dict[str, Any]] = Field(default_factory=list)
    advancedAnalysis: str = ""
    advanced_analysis: str = ""
    fullResearchSummary: str = ""
    full_research_summary: str = ""
    llm_enhanced: bool = False
    llm_provider: str = ""
    llm_model: str = ""
    llm_generated_at: str = ""
    llm_fallback_reason: str | None = None
    llmEnhanced: bool = False
    llmProvider: str = ""
    llmModel: str = ""
    llmGeneratedAt: str = ""
    llmFallbackReason: str | None = None
    llm_status: Literal["not_requested", "queued", "processing", "completed", "failed", "fallback"] | None = None
    llm_attempt_count: int = 0
    llm_last_error: str | None = None
    llm_enhancement_status: Literal["not_requested", "queued", "processing", "completed", "failed", "fallback"] | None = None
    llm_enhancement_pending: bool = False
    llmEnhancementStatus: Literal["not_requested", "queued", "processing", "completed", "failed", "fallback"] | None = None
    llmEnhancementPending: bool = False
    trustLabels: list[str] = Field(default_factory=list)
    explainabilityGeneratedAt: str = ""
    importanceScore: int = 0
    surfaceGroup: str = "Top Recommendations"
    conciseReason: str = ""
    conciseTrigger: str = ""
    primaryRisk: str = ""
    cardSummary: dict[str, Any] = Field(default_factory=dict)
    qualityWarnings: list[str] = Field(default_factory=list)
    qualityAudit: dict[str, Any] = Field(default_factory=dict)
    consensus: dict[str, Any] = Field(default_factory=dict)
    committeeSupport: list[str] = Field(default_factory=list)
    intelligenceLayerSupport: dict[str, Any] = Field(default_factory=dict)
    confidenceTier: str = ""
    fusionNotes: list[str] = Field(default_factory=list)
    # Quant factor engine (funds): real risk-adjusted metrics + personalized fit
    isFundPick: bool = False
    fundFactors: dict[str, Any] = Field(default_factory=dict)
    factorInsights: dict[str, Any] = Field(default_factory=dict)
    factorDrivers: list[str] = Field(default_factory=list)
    factorScore: int = 0
    diversification: dict[str, Any] = Field(default_factory=dict)
    goalFunding: dict[str, Any] = Field(default_factory=dict)
    disclaimer: str


class ResearchRefreshRequest(BaseModel):
    profile: OnboardingProfile | None = None
    force: bool = False


class ResearchRefreshResponse(BaseModel):
    status: str
    dataMode: DataMode
    sourcesProcessed: int
    articlesProcessed: int
    signalsGenerated: int
    assetsGenerated: int
    message: str
    retrievedAt: str


class AdvancedRecommendationRequest(BaseModel):
    profile: OnboardingProfile | None = None
    refreshResearch: bool = False


class AdvancedRecommendationResponse(BaseModel):
    recommendations: list[AdvancedRecommendation]
    signals: list[MarketSignalResponse]
    assets: list[AssetResearchResponse]
    dataMode: DataMode
    lastResearchedAt: str
    sourceCount: int
    disclaimer: str
    validationSummary: dict[str, Any] = Field(default_factory=dict)
    investorCluster: dict[str, Any] = Field(default_factory=dict)
    factorScores: dict[str, Any] = Field(default_factory=dict)
    goalFunding: dict[str, Any] = Field(default_factory=dict)
    recommendationGroups: dict[str, Any] = Field(default_factory=dict)
    consolidationSummary: dict[str, Any] = Field(default_factory=dict)
    cacheStatus: str = ""
    orchestrationVersion: str = ""
    finalOrchestration: dict[str, Any] = Field(default_factory=dict)
