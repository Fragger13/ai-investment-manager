"use client";

import { useState } from "react";
import { Check, Sparkles, Trash2 } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChoiceCard } from "../_components/choice-card";
import { CurrencyField, NumberField, SelectField, TextField } from "../_lib/field-helpers";
import { formatINR } from "@/lib/currency";
import { ScreenWrap } from "./about";
import { ScreenContext } from "../_flow/types";
import { estimatedEmi, monthsUntil } from "../_lib/onboarding-math";
import { GoalEstimateHelper } from "./goal-estimate-helper";
import { canEstimate, goalDateSuggestions } from "../_lib/goal-estimate-questions";

const GOAL_OPTIONS = [
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
  { value: "Other", label: "Something else", emoji: "✨" }
];

const GOAL_TYPE_VALUES = ["Retirement", "Financial freedom", "House purchase", "Car purchase", "Child education", "Higher education", "Marriage", "Travel", "Debt repayment", "Business/startup", "Wealth creation", "Other"];

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
      papa="No dream is too big, no goal too small. Bring them all here, beta, and we'll make them real."
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
                popular={opt.value === "Retirement"}
                onClick={() => openForType(opt.value)}
                onRemove={filled ? () => {
                  const idx = goals.findIndex((g) => g?.type === opt.value);
                  if (idx >= 0) remove(idx);
                } : undefined}
              />
            );
          })}
        </div>

        <p className="text-[0.8125rem] text-[#4B5563]">
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
        <span className="text-[2.25rem] leading-none" aria-hidden>{emoji}</span>
        <span className="text-base font-semibold leading-tight text-[#0F172A]">{label}</span>
        {filled && summary ? <span className="text-xs font-semibold text-[#138A3C]">{summary}</span> : null}
        {popular && !filled ? (
          <span className="rounded-full bg-[#E9F4EC] px-2 py-0.5 text-[0.75rem] font-semibold text-[#138A3C]">Popular</span>
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
  const [estimating, setEstimating] = useState(false);
  const [datePicking, setDatePicking] = useState(false);
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
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) return;
        // While Papa's estimate is open, a close gesture (Esc, tap-outside, or
        // the phone's back button) should return to the goal form — not discard
        // the whole goal and drop the user back at the picker.
        if (estimating) setEstimating(false);
        else onCancel();
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        {estimating ? (
          <>
            <DialogTitle className="text-lg font-semibold text-[#0F172A]">Estimate: {label}</DialogTitle>
            <p className="mt-1 text-sm text-[#4B5563]">Answer a couple of quick questions and Papa will suggest a figure.</p>
            <div className="mt-4">
              <GoalEstimateHelper
                goal={goal}
                profile={values}
                onUse={(amt) => { form.setValue(`goals.${index}.targetAmount`, amt, { shouldValidate: true }); setEstimating(false); }}
                onBack={() => setEstimating(false)}
              />
            </div>
          </>
        ) : (
          <>
        <DialogTitle className="text-lg font-semibold text-[#0F172A]">Plan: {label}</DialogTitle>
        <p className="mt-1 text-sm text-[#4B5563]">A few details and Papa will plan around it. {target > 0 ? `Est. need: ${formatINR(monthlyNeed)} / month.` : ""}</p>

        <div className="mt-4 space-y-4">
          {goal.type === "Other" ? (
            <TextField name={`goals.${index}.customName`} label="What are you saving for?" placeholder="e.g., Apple Watch, Goa trip, parents' healthcare" />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <CurrencyField
              name={`goals.${index}.targetAmount`}
              label="Target amount"
              placeholder="How much will you need?"
              hint="The full amount this goal should cost, in today's money. Don't overthink it. You can always adjust it later."
              action={
                canEstimate(goal.type) ? (
                  <button
                    type="button"
                    onClick={() => setEstimating(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#138A3C]/40 bg-[#E9F4EC] px-2 py-0.5 text-[0.6875rem] font-semibold text-[#138A3C] transition hover:border-[#138A3C] hover:bg-[#dcefe1]"
                  >
                    <Sparkles className="h-3 w-3" /> Not sure?
                  </button>
                ) : null
              }
            />
            <CurrencyField name={`goals.${index}.currentAmount`} label="Already saved" placeholder="0 if just starting" optional hint="How much you've already put aside specifically for this goal. Leave it at 0 if you're just starting." />
            <TextField
              name={`goals.${index}.targetDate`}
              type="date"
              label="Target date"
              action={
                <button
                  type="button"
                  onClick={() => setDatePicking((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#138A3C]/40 bg-[#E9F4EC] px-2 py-0.5 text-[0.6875rem] font-semibold text-[#138A3C] transition hover:border-[#138A3C] hover:bg-[#dcefe1]"
                >
                  <Sparkles className="h-3 w-3" /> Not sure?
                </button>
              }
            />
            <NumberField name={`goals.${index}.priority`} label="Priority" placeholder="1 is highest" hint="1 means most important. When money is tight, Papa funds your top goals first." />
          </div>

          {datePicking ? (
            <div className="rounded-2xl border border-[#138A3C]/25 bg-[#E9F4EC] p-4">
              <p className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[#138A3C]">
                <Sparkles className="h-3.5 w-3.5" /> Not sure when? Pick a rough timeline
              </p>
              <p className="mt-1 text-[0.8125rem] text-[#4B5563]">Papa will set a target date from this. You can fine tune it anytime.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {goalDateSuggestions(goal.type, values).map((chip) => (
                  <button
                    key={`${chip.date}-${chip.label}`}
                    type="button"
                    onClick={() => {
                      form.setValue(`goals.${index}.targetDate`, chip.date, { shouldValidate: true });
                      setDatePicking(false);
                    }}
                    className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-[0.875rem] font-medium text-[#0F172A] shadow-sm transition hover:-translate-y-0.5 hover:border-[#138A3C] hover:bg-[#F8FAF9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C]"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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
              <CurrencyField name={`goals.${index}.downPayment`} label="Down payment" placeholder="Upfront" hint="The cash you'll pay upfront from your own pocket. The loan covers the rest." />
              <NumberField name={`goals.${index}.interestRate`} label="Loan rate %" placeholder="e.g., 8.5" hint="The yearly interest the loan charges. Rough guide: home loans around 8.5%, car loans around 9 to 11%, personal loans 12% or more." />
              <NumberField name={`goals.${index}.tenureYears`} label="Tenure (yrs)" placeholder="e.g., 20" hint="How many years you'll take to repay the loan. A longer tenure means a smaller EMI but more total interest." />
            </div>
          ) : (
            <CurrencyField name={`goals.${index}.monthlyContribution`} label="Planned monthly investment" placeholder="Optional" optional />
          )}

          {isRetirementGoal ? (
            <div className="grid gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3 sm:grid-cols-2">
              <SelectField name={`goals.${index}.retirementInputType`} label="Set this by" placeholder="Pick one" options={["corpus", "monthly", "yearly"]} hint="How you'd rather describe the goal. Pick 'corpus' for a total savings target, or 'monthly' / 'yearly' for the income you want it to pay you after you stop working." />
              <NumberField name={`goals.${index}.withdrawalRate`} label="Withdrawal rate %" placeholder="Default 4" hint="How much of your nest egg you'll spend each year in retirement. 4% is the classic safe rule. Lower is more cautious, higher is riskier." />
              <CurrencyField name={`goals.${index}.desiredMonthlyIncome`} label="Desired monthly income" placeholder="e.g., 1,00,000" hint="The monthly income you'd like your investments to pay you once you're financially free, in today's money." />
              <CurrencyField name={`goals.${index}.desiredYearlyIncome`} label="Desired yearly income" placeholder="e.g., 12,00,000" hint="Same idea as monthly income, but per year. Fill in whichever is easier. They describe the same goal." />
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { GOAL_TYPE_VALUES, emptyGoal };
