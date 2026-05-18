import { AdvancedRecommendationResponse, AssetResearch, DashboardData, DocumentAnalysis, MarketSignal, OnboardingProfile, ResearchSource, ResearchStatus } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

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

export const api = {
  async login(email: string, password: string): Promise<{ access_token: string; name: string; email: string; onboarding_complete: boolean }> {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },
  async register(name: string, email: string, password: string): Promise<{ access_token: string; name: string; email: string; onboarding_complete: boolean }> {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
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
  async chat(message: string, profile?: OnboardingProfile | null): Promise<{ reply: string }> {
    return request<{ reply: string }>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, profile })
    });
  },
  async saveOnboarding(profile: OnboardingProfile) {
    return request<{ status: string; profileId: number; name: string }>("/onboarding", {
      method: "POST",
      body: JSON.stringify(profile)
    });
  },
  async latestProfile(): Promise<{ profile: OnboardingProfile | null }> {
    return request("/onboarding/latest");
  },
  async uploadDocument(file: File): Promise<DocumentAnalysis> {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentAnalysis>("/documents/upload", {
      method: "POST",
      body: form
    });
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
  async generateAdvancedRecommendations(profile?: OnboardingProfile | null, refreshResearch = false): Promise<AdvancedRecommendationResponse> {
    return request("/recommendations/generate-advanced", {
      method: "POST",
      body: JSON.stringify({ profile, refreshResearch })
    });
  },
  async latestAdvancedRecommendations(): Promise<AdvancedRecommendationResponse> {
    return request("/recommendations/latest");
  }
};
