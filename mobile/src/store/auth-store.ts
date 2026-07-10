import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import { api, setAuthToken } from "@/lib/api";
import type { OnboardingProfile } from "@/lib/types";

type User = {
  name: string;
  email: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  onboardingComplete: boolean;
  emailVerified: boolean;
  // Held in memory only (fetched after unlock) — deliberately NOT persisted:
  // the profile is the user's decrypted financial data, and keeping it off
  // disk entirely is both safer and inside SecureStore's Android size limits.
  profile: OnboardingProfile | null;
  // True once the persisted session has been read back from SecureStore.
  // Screens must wait for this before treating a null token as "logged out".
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  login: (email: string, password: string) => Promise<{ emailVerified: boolean; onboardingComplete: boolean }>;
  loadProfile: () => Promise<OnboardingProfile | null>;
  logout: () => void;
};

// SecureStore-backed storage for zustand's persist middleware. Values land in
// the Android Keystore / iOS Keychain — the token carries the user's data
// decryption key, so it never touches plain storage.
const secureStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      onboardingComplete: false,
      emailVerified: false,
      profile: null,
      hasHydrated: false,
      setHasHydrated: (value: boolean) => set({ hasHydrated: value }),
      login: async (email, password) => {
        const response = await api.login(email, password);
        setAuthToken(response.access_token);
        const latest = await api.latestProfile(response.access_token).catch(() => ({ profile: null }));
        set({
          token: response.access_token,
          user: { name: response.name, email: response.email },
          onboardingComplete: response.onboarding_complete,
          emailVerified: response.email_verified ?? true,
          profile: latest.profile,
        });
        return {
          emailVerified: response.email_verified ?? true,
          onboardingComplete: response.onboarding_complete,
        };
      },
      loadProfile: async () => {
        const token = get().token;
        if (!token) return null;
        const latest = await api.latestProfile(token).catch(() => ({ profile: null }));
        set({ profile: latest.profile });
        return latest.profile;
      },
      logout: () => {
        setAuthToken(null);
        set({ token: null, user: null, onboardingComplete: false, emailVerified: false, profile: null });
      },
    }),
    {
      name: "askpapa-session",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        onboardingComplete: state.onboardingComplete,
        emailVerified: state.emailVerified,
      }),
      onRehydrateStorage: () => (state) => {
        // Push the restored token into the api module before screens render.
        setAuthToken(state?.token ?? null);
        state?.setHasHydrated(true);
      },
    }
  )
);
