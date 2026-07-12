import { File, UploadTask, UploadType, type UploadResult } from "expo-file-system";
import type {
  AuthResponse,
  ChatResponse,
  DashboardData,
  OnboardingProfile,
  VerificationStatus,
} from "@/lib/types";

// Production API by default; EXPO_PUBLIC_API_URL overrides for local dev
// (e.g. EXPO_PUBLIC_API_URL=http://192.168.1.10:8000/api/v1 to hit a dev
// backend from a phone on the same WiFi).
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "https://api.askpapa.in/api/v1";

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

// The access token carries the user's data decryption key, so every request
// must present it. The auth store pushes the token here on login/rehydrate;
// keeping it in module state avoids a circular import (store -> api -> store)
// and avoids an async SecureStore read on every request.
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const auth: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const headers = {
    "Content-Type": "application/json",
    ...auth,
    ...((options?.headers as Record<string, string>) || {}),
  };
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "Papa could not reach the server. Check your internet connection.");
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

export type EmiBreakdownItem = { name: string; amount: number; occurrences: number };

export type StatementInsights = {
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  periodLabel: string;
  totalMonthlySpend: number;
  emiBreakdown: EmiBreakdownItem[];
};

export type DocumentAnalysis = {
  status: string;
  summary: { extractionStatus: string; confidence: number; detectedIncome: number };
  extractedFields: { field: string; label: string; value: number | string; confidence: number; status: string; explanation: string }[];
  profilePatch: Record<string, number>;
  aiFindings: string[];
  statement?: StatementInsights | null;
};

export const api = {
  async login(email: string, password: string): Promise<AuthResponse> {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  async register(name: string, email: string, password: string): Promise<VerificationStatus> {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },
  async verifyEmail(email: string, code: string): Promise<AuthResponse> {
    return request("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
  },
  async resendVerification(email: string): Promise<VerificationStatus> {
    return request("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  async latestProfile(token?: string | null): Promise<{ profile: OnboardingProfile | null }> {
    return request("/onboarding/latest", {
      headers: authHeaders(token),
    });
  },
  async saveOnboarding(profile: Record<string, unknown>, options?: { partial?: boolean }): Promise<{ status: string; profileId: number }> {
    const suffix = options?.partial ? "?partial=true" : "";
    return request(`/onboarding${suffix}`, {
      method: "POST",
      body: JSON.stringify(profile),
    });
  },
  // Multipart upload via the SDK 57 UploadTask (native networking). RN
  // fetch+FormData file parts are unreliable on Android, and the legacy
  // FileSystem.uploadAsync has no native module in current Expo Go.
  // doc_type tells the backend which profile fields this document may fill.
  // pdfPassword unlocks bank PDFs; a locked PDF without it comes back as a
  // 422 with detail "pdf_password_required".
  async uploadDocument(
    file: { uri: string; name: string; mimeType: string },
    docType?: string,
    pdfPassword?: string
  ): Promise<DocumentAnalysis> {
    const headers: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    let result: UploadResult;
    try {
      const task = new UploadTask(new File(file.uri), `${API_BASE}/documents/upload`, {
        httpMethod: "POST",
        uploadType: UploadType.MULTIPART,
        fieldName: "file",
        mimeType: file.mimeType,
        parameters: {
          ...(docType ? { doc_type: docType } : {}),
          ...(pdfPassword ? { pdf_password: pdfPassword } : {}),
        },
        headers,
      });
      result = await task.uploadAsync();
    } catch (e) {
      // Real reason matters: file unreadable vs network vs module issues all
      // land here. Show it instead of blaming the connection.
      const reason = e instanceof Error ? e.message : "unknown error";
      throw new ApiError(0, `Upload failed on the phone: ${reason}`);
    }
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(result.body);
    } catch {
      // non-JSON error body; fall through to status check
    }
    if (result.status < 200 || result.status >= 300) {
      throw new ApiError(result.status, String(body.detail || `Upload failed: ${result.status}`));
    }
    return body as unknown as DocumentAnalysis;
  },
  async dashboard(profile: OnboardingProfile): Promise<DashboardData> {
    return request<DashboardData>("/intelligence/dashboard", {
      method: "POST",
      body: JSON.stringify(profile),
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
      signal: options?.signal,
    });
  },
};
