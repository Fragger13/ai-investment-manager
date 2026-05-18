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
    assetType: str
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
