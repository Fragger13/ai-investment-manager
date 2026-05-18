"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import { OnboardingProfile } from "@/types";

type User = {
  name: string;
  email: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  onboardingComplete: boolean;
  profile: OnboardingProfile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  saveProfile: (profile: OnboardingProfile, complete?: boolean) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      onboardingComplete: false,
      profile: null,
      login: async (email, password) => {
        const response = await api.login(email, password);
        const latest = await api.latestProfile().catch(() => ({ profile: null }));
        set({
          token: response.access_token,
          user: { name: response.name, email: response.email },
          onboardingComplete: response.onboarding_complete || Boolean(latest.profile),
          profile: latest.profile
        });
      },
      register: async (name, email, password) => {
        const response = await api.register(name, email, password);
        set({ token: response.access_token, user: { name: response.name, email: response.email }, onboardingComplete: response.onboarding_complete });
      },
      logout: () => set({ token: null, user: null, onboardingComplete: false, profile: null }),
      saveProfile: (profile, complete = false) => {
        if (complete) localStorage.setItem("aim-onboarded", "true");
        set({ profile, onboardingComplete: complete || false });
      }
    }),
    {
      name: "ai-investment-manager-session",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        onboardingComplete: state.onboardingComplete,
        profile: state.profile
      })
    }
  )
);
