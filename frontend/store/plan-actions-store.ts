"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

// Actions recorded on the backend are stamped with the logged-in user so
// portfolio views stay per-account; read the token at call time (not module
// load) so login/logout is always respected.
const sessionToken = () => useAuthStore.getState().token;

export type PlanItem = {
  key: string;
  instrumentName: string;
  category: string;
  ticker: string;
  suggestedMonthlyAmount: number;
  source: "recommendation" | "discover";
  addedAt: string;
};

export type ActionTaken = {
  key: string;
  instrumentName: string;
  category: string;
  ticker: string;
  amount: number;
  startDate: string;
  endDate: string;
  actionType: string;
  notes: string;
  takenAt: string;
  /** Recurring monthly SIP vs a single one-time lump sum. Drives whether the
   *  amount reduces the monthly budget and how the backend values the holding.
   *  Legacy actions (no cadence) are treated as "monthly". */
  cadence?: "monthly" | "one_time";
  /** Per-unit purchase price recorded for this buy. Defaults to the live market
   *  price at the time of taking action; the user can override it. `livePrice`
   *  keeps the market reference shown in the dialog. */
  purchasePrice?: number;
  livePrice?: number;
  /** The goal this action funds, when started from a goal-linked recommendation.
   *  Persisted so the backend can credit the contribution to that goal. */
  goalName?: string;
};

type PlanActionsState = {
  planItems: PlanItem[];
  actionsTaken: ActionTaken[];
  addToPlan: (item: Omit<PlanItem, "addedAt">) => void;
  removeFromPlan: (key: string) => void;
  recordAction: (action: Omit<ActionTaken, "takenAt">) => void;
  removeAction: (key: string) => void;
  hasInPlan: (key: string) => boolean;
  actionFor: (key: string) => ActionTaken | undefined;
};

export const usePlanActionsStore = create<PlanActionsState>()(
  persist(
    (set, get) => ({
      planItems: [],
      actionsTaken: [],
      addToPlan: (item) => {
        const exists = get().planItems.some((entry) => entry.key === item.key);
        const next: PlanItem = { ...item, addedAt: new Date().toISOString() };
        if (!exists) set({ planItems: [next, ...get().planItems] });
        api.recordUserAction({
          actionType: "added_to_plan",
          entityType: "investment_idea",
          entityId: item.key,
          entityName: item.instrumentName,
          recommendationKey: item.key,
          instrumentName: item.instrumentName,
          suggestedMonthlyAmount: item.suggestedMonthlyAmount,
        }, sessionToken()).catch(() => null);
      },
      removeFromPlan: (key) => {
        set({ planItems: get().planItems.filter((entry) => entry.key !== key) });
      },
      recordAction: (action) => {
        const next: ActionTaken = { ...action, takenAt: new Date().toISOString() };
        set({ actionsTaken: [next, ...get().actionsTaken.filter((entry) => entry.key !== action.key)] });
        api.recordUserAction({
          actionType: action.actionType || "took_action",
          entityType: "recommendation",
          entityId: action.key,
          entityName: action.instrumentName,
          recommendationKey: action.key,
          instrumentName: action.instrumentName,
          amount: action.amount,
          startDate: action.startDate,
          endDate: action.endDate,
          notes: action.notes,
          category: action.category,
          cadence: action.cadence,
          purchasePrice: action.purchasePrice,
          livePrice: action.livePrice,
          goalName: action.goalName,
        }, sessionToken()).catch(() => null);
      },
      removeAction: (key) => {
        set({ actionsTaken: get().actionsTaken.filter((entry) => entry.key !== key) });
        api.removeUserAction(key, sessionToken()).catch(() => null);
      },
      hasInPlan: (key) => get().planItems.some((entry) => entry.key === key),
      actionFor: (key) => get().actionsTaken.find((entry) => entry.key === key),
    }),
    {
      name: "ai-investment-manager-plan",
      partialize: (state) => ({ planItems: state.planItems, actionsTaken: state.actionsTaken }),
    }
  )
);
