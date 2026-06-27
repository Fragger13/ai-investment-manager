"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type TourState = {
  active: boolean;
  stepIndex: number;
  seen: boolean;
  start: () => void;            // (re)start from the top
  stop: () => void;             // finish or skip → mark seen, never auto-runs again
  setStep: (index: number) => void;
};

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      active: false,
      stepIndex: 0,
      seen: false,
      start: () => set({ active: true, stepIndex: 0 }),
      stop: () => set({ active: false, stepIndex: 0, seen: true }),
      setStep: (index) => set({ stepIndex: Math.max(0, index) }),
    }),
    {
      name: "askpapa-tour-v1",
      // Persist `seen` so it runs once; persist `active`/`stepIndex` so a
      // mid-tour route change or reload resumes cleanly.
      partialize: (state) => ({ seen: state.seen, active: state.active, stepIndex: state.stepIndex }),
    },
  ),
);
