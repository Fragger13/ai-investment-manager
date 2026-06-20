"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import { isOnboardingComplete } from "@/lib/profile";
import { OnboardingProfile } from "@/types";

type User = {
  name: string;
  email: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  onboardingComplete: boolean;
  emailVerified: boolean;
  profile: OnboardingProfile | null;
  login: (email: string, password: string) => Promise<{ emailVerified: boolean; onboardingComplete: boolean }>;
  register: (name: string, email: string, password: string) => Promise<{ emailVerified: boolean; sent: boolean }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => void;
  saveProfile: (profile: OnboardingProfile, complete?: boolean) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      onboardingComplete: false,
      emailVerified: false,
      profile: null,
      login: async (email, password) => {
        const response = await api.login(email, password);
        const latest = await api.latestProfile(response.access_token).catch(() => ({ profile: null }));
        const profileComplete = isOnboardingComplete(latest.profile);
        set({
          token: response.access_token,
          user: { name: response.name, email: response.email },
          onboardingComplete: response.onboarding_complete && profileComplete,
          emailVerified: response.email_verified ?? true,
          profile: latest.profile
        });
        return {
          emailVerified: response.email_verified ?? true,
          onboardingComplete: response.onboarding_complete && profileComplete
        };
      },
      register: async (name, email, password) => {
        // No account exists until the email code is verified — so there are no
        // tokens to store yet. Just relay whether the code email went out.
        const response = await api.register(name, email, password);
        return { emailVerified: response.email_verified ?? false, sent: response.sent };
      },
      verifyEmail: async (email, code) => {
        const response = await api.verifyEmail(email, code);
        set({
          token: response.access_token,
          user: { name: response.name, email: response.email },
          onboardingComplete: response.onboarding_complete,
          emailVerified: response.email_verified ?? true
        });
      },
      logout: () => {
        try {
          window.localStorage.removeItem("askpapa_onboarding_screen");
          window.localStorage.removeItem("askpapa_chat_v1");
          window.localStorage.removeItem("askpapa_chat_active_v1");
        } catch { /* ignore */ }
        set({ token: null, user: null, onboardingComplete: false, emailVerified: false, profile: null });
      },
      saveProfile: (profile, complete = false) => {
        if (complete) localStorage.setItem("aim-onboarded", "true");
        set({ profile, onboardingComplete: complete && isOnboardingComplete(profile) });
      }
    }),
    {
      name: "ai-investment-manager-session",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        onboardingComplete: state.onboardingComplete,
        emailVerified: state.emailVerified,
        profile: state.profile
      })
    }
  )
);
