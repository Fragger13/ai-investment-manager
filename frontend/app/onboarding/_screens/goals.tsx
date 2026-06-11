"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChoiceCard } from "../_components/choice-card";
import { CurrencyField, NumberField, SelectField, TextField } from "../_lib/field-helpers";
import { formatINR } from "@/lib/currency";
import { ScreenWrap } from "./about";
import { ScreenContext } from "../_flow/types";
import { estimatedEmi, monthsUntil } from "../_lib/onboarding-math";

const GOAL_OPTIONS = [
  { value: "Emergency fund", label: "Emergency fund", emoji: "🛡️" },
  { value: "Retirement", label: "Retirement", emoji: "🏖️" },
  { value: "Financial freedom", label: "Financial freedom", emoji: "🕊️" },
  { value: "House purchase", label: "House", emoji: "🏠" },
  { value: "Car purchase", label: "Car", emoji: "🚗" },
  { value: "Child education", label: "Child education", emoji: "🎓" },
  { value: "Higher education", label: "Higher education", emoji: "📚" },
  { value: "Marriage", label: "Marriage", emoji: "💍" },
  { value: "Travel", label: "Travel", emoji: "✈️" },
  { value: "Debt repayment", label: "Pay off debt", emoji: "💳" },
  { value: "Business/startup", label: "Start a business", emoji: "🚀" },
  { value: "Wealth creation", label: "Build wealth", emoji: "📈" },
  { value: "Other", label: "Something else", emoji: "✨" }
];

const GOAL_TYPE_VALUES = ["Emergency fund", "Retirement", "Financial freedom", "House purchase", "Car purchase", "Child education", "Higher education", "Marriage", "Travel", "Debt repayment", "Business/startup", "Wealth creation", "Other"];

function emptyGoal(priority: number) {
  return {
    type: "",
    customName: "",
    priority,
    targetAmount: 0,
    currentAmount: 0,
    targetDate: "",
    paymentStyle: "lumpsum" as const,
    interestRate: 8.5,
    tenureYears: 5,
    downPayment: 0,
    monthlyContribution: 0,
    internationalTrips: 0,
    domesticTrips: 0,
    internationalTripCost: 200000,
    domesticTripCost: 60000,
    retirementInputType: "corpus",
    desiredMonthlyIncome: 0,
    desiredYearlyIncome: 0,
    withdrawalRate: 4,
    notes: ""
  };
}

export function GoalsScreen({ form, values }: ScreenContext) {
  const goals = values.goals || [];
  const { append, remove } = useFieldArray({ control: form.control, name: "goals" });

  const [dialogIndex, setDialogIndex] = useState<number | null>(null);
  const [isNewGoal, setIsNewGoal] = useState(false);

  const openForType = (type: string) => {
    const existingIdx = goals.findIndex((g) => g?.type === type);
    if (existingIdx >= 0) {
      setDialogIndex(existingIdx);
      setIsNewGoal(false);
    } else {
      const newIndex = goals.length;
      append({ ...emptyGoal(newIndex + 1), type });
      setDialogIndex(newIndex);
      setIsNewGoal(true);
    }
  };

  const cancelDialog = () => {
    if (isNewGoal && dialogIndex !== null) {
      remove(dialogIndex);
    }
    setDialogIndex(null);
    setIsNewGoal(false);
  };
  const saveDialog = () => {
    setDialogIndex(null);
    setIsNewGoal(false);
  };

  return (
    <ScreenWrap
      papa="Dreams are free. Achieving them sends invoices."
      headline="Your goals"
      sub="Tap any goal to plan it. Add as many as you like."
      mood="loving"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {GOAL_OPTIONS.map((opt) => {
            const goal = goals.find((g) => g?.type === opt.value);
            const filled = Boolean(goal);
            const summary = goal && Number(goal.targetAmount) > 0 ? formatINR(Number(goal.targetAmount)) : "";
            return (
              <GoalChip
                key={opt.value}
                label={opt.label}
                emoji={opt.emoji}
                filled={filled}
                summary={summary}
                popular={opt.value === "Emergency fund" || opt.value === "Retirement"}
                onClick={() => openForType(opt.value)}
                onRemove={filled ? () => {
                  const idx = goals.findIndex((g) => g?.type === opt.value);
                  if (idx >= 0) remove(idx);
                } : undefined}
              />
            );
          })}
        </div>

        <p className="text-[13px] text-[#4B5563]">
          {goals.length === 0
            ? "Pick at least one goal to continue. Each opens its own little planner."
            : `${goals.length} goal${goals.length > 1 ? "s" : ""} planned. Tap a tile to edit, X to remove.`}
        </p>
      </div>

      {dialogIndex !== null && goals[dialogIndex] ? (
        <GoalDialog
          open={dialogIndex !== null}
          index={dialogIndex}
          form={form}
          values={values}
          isNew={isNewGoal}
          onCancel={cancelDialog}
          onSave={saveDialog}
        />
      ) : null}
    </ScreenWrap>
  );
}

function GoalChip({
  label,
  emoji,
  filled,
  summary,
  popular = false,
  onClick,
  onRemove
}: {
  label: string;
  emoji: string;
  filled: boolean;
  summary?: string;
  popular?: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition hover:-translate-y-0.5 hover:shadow-lg ${
          filled
            ? "border-[#138A3C] bg-[#E9F4EC] shadow-md"
            : "border-[#E5E7EB] bg-white shadow-md"
        }`}
      >
        <span className="text-[36px] leading-none" aria-hidden>{emoji}</span>
        <span className="text-base font-semibold leading-tight text-[#0F172A]">{label}</span>
        {filled && summary ? <span className="text-xs font-semibold text-[#138A3C]">{summary}</span> : null}
        {popular && !filled ? (
          <span className="rounded-full bg-[#E9F4EC] px-2 py-0.5 text-[12px] font-semibold text-[#138A3C]">Popular</span>
        ) : null}
        {filled ? (
          <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#138A3C] text-white">
            <Check className="h-3 w-3" />
          </span>
        ) : null}
      </button>
      {filled && onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#4B5563] shadow-sm hover:text-[#0F172A]"
          aria-label={`Remove ${label}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function GoalDialog({
  open,
  index,
  form,
  values,
  isNew,
  onCancel,
  onSave
}: {
  open: boolean;
  index: number;
  form: ScreenContext["form"];
  values: ScreenContext["values"];
  isNew: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const goal = values.goals?.[index];
  if (!goal) return null;
  const label = goal.type === "Other" ? goal.customName || "Custom goal" : goal.type;
  const target = Number(goal.targetAmount || 0);
  const current = Number(goal.currentAmount || 0);
  const months = monthsUntil(goal.targetDate) || 12;
  const monthlyNeed = goal.paymentStyle === "emi"
    ? estimatedEmi(Math.max(target - Number(goal.downPayment || 0), 0), Number(goal.interestRate || 0), Number(goal.tenureYears || 1))
    : Math.ceil(Math.max(target - current, 0) / months);
  const isRetirementGoal = goal.type === "Retirement" || goal.type === "Financial freedom";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogTitle className="text-lg font-semibold text-[#0F172A]">Plan: {label}</DialogTitle>
        <p className="mt-1 text-sm text-[#4B5563]">A few details and Papa will plan around it. {target > 0 ? `Est. need: ${formatINR(monthlyNeed)} / month.` : ""}</p>

        <div className="mt-4 space-y-4">
          {goal.type === "Other" ? (
            <TextField name={`goals.${index}.customName`} label="What's this goal called?" placeholder="e.g., Parents' healthcare" />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <CurrencyField name={`goals.${index}.targetAmount`} label="Target amount" placeholder="How much will you need?" />
            <CurrencyField name={`goals.${index}.currentAmount`} label="Already saved" placeholder="0 if just starting" optional />
            <TextField name={`goals.${index}.targetDate`} type="date" label="Target date" />
            <NumberField name={`goals.${index}.priority`} label="Priority" placeholder="1 is highest" />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-[#0F172A]">How will you fund it?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                title="Save up over time"
                helper="SIPs or savings"
                emoji="🐢"
                selected={goal.paymentStyle === "lumpsum"}
                onSelect={() => form.setValue(`goals.${index}.paymentStyle`, "lumpsum", { shouldValidate: true })}
              />
              <ChoiceCard
                title="Take a loan, pay EMI"
                helper="Loan with monthly EMI"
                emoji="🏦"
                selected={goal.paymentStyle === "emi"}
                onSelect={() => form.setValue(`goals.${index}.paymentStyle`, "emi", { shouldValidate: true })}
              />
            </div>
          </div>

          {goal.paymentStyle === "emi" ? (
            <div className="grid gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3 sm:grid-cols-3">
              <CurrencyField name={`goals.${index}.downPayment`} label="Down payment" placeholder="Upfront" />
              <NumberField name={`goals.${index}.interestRate`} label="Loan rate %" placeholder="e.g., 8.5" />
              <NumberField name={`goals.${index}.tenureYears`} label="Tenure (yrs)" placeholder="e.g., 20" />
            </div>
          ) : (
            <CurrencyField name={`goals.${index}.monthlyContribution`} label="Planned monthly investment" placeholder="Optional" optional />
          )}

          {isRetirementGoal ? (
            <div className="grid gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3 sm:grid-cols-2">
              <SelectField name={`goals.${index}.retirementInputType`} label="Set this by" placeholder="Pick one" options={["corpus", "monthly", "yearly"]} />
              <NumberField name={`goals.${index}.withdrawalRate`} label="Withdrawal rate %" placeholder="Default 4" />
              <CurrencyField name={`goals.${index}.desiredMonthlyIncome`} label="Desired monthly income" placeholder="e.g., 1,00,000" />
              <CurrencyField name={`goals.${index}.desiredYearlyIncome`} label="Desired yearly income" placeholder="e.g., 12,00,000" />
            </div>
          ) : null}

          <TextField name={`goals.${index}.notes`} label="Notes" placeholder="Any details to remember" optional />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>{isNew ? "Discard" : "Cancel"}</Button>
          <Button type="button" className="bg-[#138A3C] text-white hover:bg-[#107132]" onClick={onSave}>
            Save & back to picker
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { GOAL_TYPE_VALUES, emptyGoal };
