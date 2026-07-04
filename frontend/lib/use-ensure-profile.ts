"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { isOnboardingComplete } from "@/lib/profile";
import { useAuthStore } from "@/store/auth-store";

/**
 * Ensures the onboarding profile is present in the auth store.
 *
 * The Dashboard already recovers the profile from the backend when the store is
 * empty; Portfolio and Plan did not, so on a direct load/refresh (or before the
 * persisted session rehydrates, or any time the token outlives the stored
 * profile) they computed everything — including "available this month" — from a
 * null profile and disagreed with the Dashboard. This hook gives every page the
 * same self-healing behaviour: if we have a token but no profile, fetch it once
 * and save it, which re-runs the page's own data load with the real profile.
 *
 * Returns the (possibly newly populated) profile for convenience.
 */
export function useEnsureProfile() {
  const profile = useAuthStore((state) => state.profile);
  const token = useAuthStore((state) => state.token);
  const saveProfile = useAuthStore((state) => state.saveProfile);
  // Only attempt one fetch per token so a backend with no saved profile yet
  // (e.g. a freshly verified user mid-onboarding) doesn't get hammered.
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (profile || !token) return;
    if (fetchedFor.current === token) return;
    fetchedFor.current = token;
    let cancelled = false;
    api
      .latestProfile(token)
      .then((res) => {
        if (!cancelled && res.profile) saveProfile(res.profile, isOnboardingComplete(res.profile));
      })
      .catch(() => {
        // Offline / no profile yet — pages fall back to their empty states.
      });
    return () => {
      cancelled = true;
    };
  }, [profile, token, saveProfile]);

  return profile;
}
