import { AdvancedRecommendation, AdvancedRecommendationResponse, AlphaOpportunity, AssetIntelligence, AssetResearch, CommunitySentiment, CryptoOpportunity, DashboardData, DocumentAnalysis, DriftAlert, DriftResponse, FinancialCopilotBrief, Holding, MarketRegime, MarketSignal, MemoryTimeline, OnboardingProfile, PortfolioOptimization, PortfolioRebalancingSuggestion, PortfolioRiskMetric, PortfolioSummary, PortfolioTargetAllocation, PortfolioValidation, RecommendationReassessment, RecommendationVersion, ResearchSource, ResearchStatus, SignalImpactMap, SignalReliability, StrategyBacktest, ValidationRefresh } from "@/types";

// API base resolution:
//  • An explicit NEXT_PUBLIC_API_URL always wins.
//  • On localhost we hit the backend directly. The Next dev rewrite proxy drops
//    long-running LLM requests (ECONNRESET / "socket hang up"), so we only route
//    through it for remote origins (e.g. an ngrok share) where same-origin
//    proxying is actually required.
function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "http://127.0.0.1:8000/api/v1";
    return "/api/v1"; // remote origin → same-origin path, proxied by next.config rewrite
  }
  return "http://127.0.0.1:8000/api/v1";
}

const API_BASE = resolveApiBase();

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

export type GoalEstimate = {
  amount: number;
  low: number;
  high: number;
  rationale: string;
  assumptions: string[];
  source: "ai" | "calculator";
};

export type GoalClarifyQuestion = {
  key: string;
  prompt: string;
  options: { value: string; label: string }[];
};

export type LlmEnhancementStatusResponse = {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  fallback: number;
  pending: number;
  lastUpdated: string;
  byType: Record<string, Record<string, number>>;
  items?: {
    itemType: string;
    itemId: string;
    status: string;
    enhanced: boolean;
    model: string;
    fallbackReason?: string | null;
    attemptCount: number;
    lastError?: string | null;
    durationMs: number;
    generatedAt: string;
    updatedAt: string;
  }[];
};

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = options?.body instanceof FormData
    ? options.headers
    : {
        "Content-Type": "application/json",
        ...(options?.headers || {})
      };
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new ApiError(0, "Backend unavailable. Check that the API server is running on port 8000.");
  }
  if (!response.ok) {
    const text = await response.text();
    let detail = text || `API request failed: ${response.status}`;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.detail || detail;
    } catch {
      // Keep the raw response text.
    }
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

export const api = {
  async login(email: string, password: string): Promise<AuthResponse> {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },
  async register(name: string, email: string, password: string): Promise<VerificationStatus> {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    });
  },
  async verifyEmail(email: string, code: string): Promise<AuthResponse> {
    return request("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, code })
    });
  },
  async resendVerification(email: string): Promise<VerificationStatus> {
    return request("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  },
  async passwordReset(email: string): Promise<{ status: string; email: string }> {
    return request("/auth/password-reset", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  },
  async dashboard(profile: OnboardingProfile): Promise<DashboardData> {
    return request<DashboardData>("/intelligence/dashboard", {
      method: "POST",
      body: JSON.stringify(profile)
    });
  },
  async financialCopilot(profile?: OnboardingProfile | null): Promise<FinancialCopilotBrief> {
    return request<FinancialCopilotBrief>("/copilot/daily-brief", {
      method: "POST",
      body: JSON.stringify(profile || null)
    });
  },
  async chat(
    message: string,
    profile?: OnboardingProfile | null,
    history?: { role: "user" | "assistant"; content: string }[],
    options?: { signal?: AbortSignal }
  ): Promise<ChatResponse> {
    return request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, profile, history: history || [] }),
      signal: options?.signal
    });
  },
  async estimateGoal(
    goalType: string,
    answers: Record<string, string>,
    profile?: OnboardingProfile | null,
    options?: { signal?: AbortSignal }
  ): Promise<GoalEstimate> {
    return request<GoalEstimate>("/chat/goal-estimate", {
      method: "POST",
      body: JSON.stringify({ goalType, answers, profile }),
      signal: options?.signal
    });
  },
  async clarifyGoal(
    description: string,
    profile?: OnboardingProfile | null,
    options?: { signal?: AbortSignal }
  ): Promise<{ questions: GoalClarifyQuestion[] }> {
    return request<{ questions: GoalClarifyQuestion[] }>("/chat/goal-clarify", {
      method: "POST",
      body: JSON.stringify({ description, profile }),
      signal: options?.signal
    });
  },
  async saveOnboarding(profile: OnboardingProfile, token?: string | null, options?: { partial?: boolean }) {
    const query = options?.partial ? "?partial=true" : "";
    return request<{ status: string; profileId: number; name: string }>(`/onboarding${query}`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(profile)
    });
  },
  async latestProfile(token?: string | null): Promise<{ profile: OnboardingProfile | null }> {
    return request("/onboarding/latest", {
      headers: authHeaders(token)
    });
  },
  async uploadDocument(file: File): Promise<DocumentAnalysis> {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentAnalysis>("/documents/upload", {
      method: "POST",
      body: form
    });
  },
  async importHoldings(file: File): Promise<{ holdings: Holding[]; unmappedRows: number; warnings: string[] }> {
    const form = new FormData();
    form.append("file", file);
    return request("/holdings/import", {
      method: "POST",
      body: form
    });
  },
  async refreshHoldingPrices(holdings: Holding[]): Promise<{ holdings: Holding[]; refreshedAt: string }> {
    return request("/holdings/refresh-prices", {
      method: "POST",
      body: JSON.stringify({ holdings })
    });
  },
  async quoteUnitPrice(symbol: string, assetClass: string, name = ""): Promise<{ symbol: string; assetClass: string; price: number | null; asOf: string }> {
    return request(`/holdings/quote?symbol=${encodeURIComponent(symbol)}&assetClass=${encodeURIComponent(assetClass)}&name=${encodeURIComponent(name)}`);
  },
  async communitySentiment(name: string, assetClass: string): Promise<CommunitySentiment> {
    return request(`/assets/community-sentiment?name=${encodeURIComponent(name)}&assetClass=${encodeURIComponent(assetClass)}`);
  },
  async submitFeedback(payload: { kind: string; category?: string; rating?: number; message?: string; email?: string; page?: string }): Promise<{ status: string; id: number }> {
    return request("/feedback", { method: "POST", body: JSON.stringify(payload) });
  },
  async analyzeDocument(fileName: string): Promise<DocumentAnalysis> {
    return request<DocumentAnalysis>("/documents/analyze", {
      method: "POST",
      body: JSON.stringify({ file_name: fileName, file_type: fileName.split(".").pop() || "unknown" })
    });
  },
  async refreshResearch(profile?: OnboardingProfile | null) {
    return request<{ status: string; dataMode: string; sourcesProcessed: number; articlesProcessed: number; signalsGenerated: number; assetsGenerated: number; message: string; retrievedAt: string }>("/research/refresh", {
      method: "POST",
      body: JSON.stringify({ profile, force: true })
    });
  },
  async researchSources(): Promise<ResearchSource[]> {
    return request("/research/sources");
  },
  async researchSignals(): Promise<MarketSignal[]> {
    return request("/research/signals");
  },
  async researchAssets(): Promise<AssetResearch[]> {
    return request("/research/assets");
  },
  async researchStatus(): Promise<ResearchStatus> {
    return request("/research/status");
  },
  async marketRegime(): Promise<MarketRegime> {
    return request("/market/regime");
  },
  async marketSignals(): Promise<MarketSignal[]> {
    return request("/market/signals");
  },
  async marketSignal(id: number): Promise<MarketSignal> {
    return request(`/market/signals/${id}`);
  },
  async refreshMarketSignalCopy(id: number): Promise<MarketSignal> {
    return request(`/market/signals/${id}/refresh-copy`, {
      method: "POST"
    });
  },
  async refreshMarketSignalCopies(): Promise<MarketSignal[]> {
    return request("/market/signals/refresh-copy", {
      method: "POST"
    });
  },
  async marketImpactMap(): Promise<SignalImpactMap[]> {
    return request("/market/impact-map");
  },
  async refreshMarketIntelligence() {
    return request<{ status: string; research: unknown; intelligence: unknown }>("/market/refresh-intelligence", {
      method: "POST"
    });
  },
  async generateAdvancedRecommendations(profile?: OnboardingProfile | null, refreshResearch = false): Promise<AdvancedRecommendationResponse> {
    return request("/recommendations/generate-advanced", {
      method: "POST",
      body: JSON.stringify({ profile, refreshResearch })
    });
  },
  async latestAdvancedRecommendations(): Promise<AdvancedRecommendationResponse> {
    return request("/recommendations/latest");
  },
  async refreshRecommendationExplanation(id: string | number): Promise<AdvancedRecommendation> {
    return request(`/recommendations/${encodeURIComponent(String(id))}/refresh-explanation`, {
      method: "POST"
    });
  },
  async refreshRecommendationExplanations(profile?: OnboardingProfile | null): Promise<AdvancedRecommendationResponse> {
    return request("/recommendations/refresh-explanations", {
      method: "POST",
      body: JSON.stringify({ profile })
    });
  },
  async refreshAssetResearch() {
    return request<{ status: string; assetsProcessed: number; technicalSignals: number; fundamentalSignals: number; cryptoOpportunities: number; alphaOpportunities: number; dataMode: string; retrievedAt: string }>("/assets/refresh-research", {
      method: "POST"
    });
  },
  async assetIntelligence(): Promise<AssetIntelligence[]> {
    return request("/assets/research");
  },
  async refreshAssetCopy(symbol: string): Promise<AssetIntelligence> {
    return request(`/assets/${encodeURIComponent(symbol)}/refresh-copy`, {
      method: "POST"
    });
  },
  async refreshAssetCopies(): Promise<AssetIntelligence[]> {
    return request("/assets/refresh-copy", {
      method: "POST"
    });
  },
  async llmEnhancementStatus(itemType?: "recommendation" | "market" | "asset", details = false): Promise<LlmEnhancementStatusResponse> {
    const search = new URLSearchParams();
    if (itemType) search.set("itemType", itemType);
    if (details) search.set("details", "true");
    return request(`/llm/enhancement-status${search.size ? `?${search.toString()}` : ""}`);
  },
  async enhanceLlmCopy(itemType: "recommendations" | "market" | "assets" | "all", force = true): Promise<{ status: string; itemType?: string; itemCount?: number; pendingCount?: number }> {
    return request(`/llm/enhance/${itemType}?force=${force ? "true" : "false"}`, {
      method: "POST"
    });
  },
  async summarizeText(text: string, maxWords = 30, fallback?: string): Promise<{ summary: string }> {
    return request("/llm/summarize", {
      method: "POST",
      body: JSON.stringify({ text, maxWords, fallback }),
    });
  },
  async alphaOpportunities(): Promise<AlphaOpportunity[]> {
    return request("/assets/alpha-opportunities");
  },
  async cryptoOpportunities(): Promise<CryptoOpportunity[]> {
    return request("/assets/crypto-opportunities");
  },
  async technicalSignals(): Promise<AssetIntelligence["technical"][]> {
    return request("/assets/technical-signals");
  },
  async fundamentalSignals(): Promise<AssetIntelligence["fundamental"][]> {
    return request("/assets/fundamental-signals");
  },
  async refreshValidation(): Promise<ValidationRefresh> {
    return request("/validation/refresh", {
      method: "POST"
    });
  },
  async strategyBacktests(): Promise<StrategyBacktest[]> {
    return request("/validation/strategies");
  },
  async signalValidations(): Promise<SignalReliability[]> {
    return request("/validation/signals");
  },
  async signalReliability(): Promise<SignalReliability[]> {
    return request("/validation/reliability");
  },
  async portfolioValidation(): Promise<PortfolioValidation[]> {
    return request("/validation/portfolio");
  },
  async portfolioOptimization(): Promise<PortfolioOptimization> {
    return request("/portfolio/optimization");
  },
  async portfolioSummary(profile?: OnboardingProfile | null, token?: string | null): Promise<PortfolioSummary> {
    return request("/portfolio/summary", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(profile || null),
    });
  },
  async optimizePortfolio(profile?: OnboardingProfile | null): Promise<PortfolioOptimization> {
    return request("/portfolio/optimize", {
      method: "POST",
      body: JSON.stringify(profile || null)
    });
  },
  async allocationTargets(): Promise<PortfolioTargetAllocation[]> {
    return request("/portfolio/allocation-targets");
  },
  async portfolioRiskAnalysis(): Promise<{ summary: PortfolioOptimization["summary"]; riskMetrics: PortfolioRiskMetric[]; riskWarnings: string[]; regimeAdjustments: string[] }> {
    return request("/portfolio/risk-analysis");
  },
  async rebalancingSuggestions(): Promise<PortfolioRebalancingSuggestion[]> {
    return request("/portfolio/rebalancing-suggestions");
  },
  async metalPrice(metal: "gold" | "silver"): Promise<{ metal: string; inrPerGram: number }> {
    return request(`/portfolio/metal-price/${metal}`);
  },
  async memoryTimeline(): Promise<MemoryTimeline> {
    return request("/memory/timeline");
  },
  async recommendationHistory(): Promise<RecommendationVersion[]> {
    return request("/memory/recommendations/history");
  },
  async recordUserAction(payload: { actionType: string; entityType?: string; entityId?: string; entityName?: string; recommendationKey?: string; instrumentName?: string; [key: string]: unknown }, token?: string | null) {
    return request("/memory/user-action", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(payload)
    });
  },
  async removeUserAction(key: string, token?: string | null): Promise<{ status: string; deleted: number; key: string }> {
    return request(`/memory/user-action/by-key/${encodeURIComponent(key)}`, { method: "DELETE", headers: authHeaders(token) });
  },
  async recommendationVersions(recommendationKey?: string): Promise<RecommendationVersion[]> {
    return request(`/recommendations/versions${recommendationKey ? `?recommendationKey=${encodeURIComponent(recommendationKey)}` : ""}`);
  },
  async reassessRecommendations(profile?: OnboardingProfile | null, trigger = "manual reassessment"): Promise<RecommendationReassessment> {
    return request("/recommendations/reassess", {
      method: "POST",
      body: JSON.stringify({ profile, trigger })
    });
  },
  async portfolioDrift(): Promise<DriftResponse> {
    return request("/drift/portfolio");
  },
  async goalDrift(): Promise<DriftResponse> {
    return request("/drift/goals");
  },
  async behaviorDrift(): Promise<DriftResponse> {
    return request("/drift/behavior");
  },
  async driftAlerts(): Promise<DriftAlert[]> {
    return request("/alerts/drift");
  }
};
