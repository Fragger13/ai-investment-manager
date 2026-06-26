"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

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
        }).catch(() => null);
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
          goalName: action.goalName,
        }).catch(() => null);
      },
      removeAction: (key) => {
        set({ actionsTaken: get().actionsTaken.filter((entry) => entry.key !== key) });
        api.removeUserAction(key).catch(() => null);
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
