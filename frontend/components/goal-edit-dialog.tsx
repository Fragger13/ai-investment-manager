"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, IndianRupee, Sparkles, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { OnboardingProfile, ProfileGoal } from "@/types";
import { GoalEstimateHelper } from "@/app/onboarding/_screens/goal-estimate-helper";
import { goalDateSuggestions } from "@/app/onboarding/_lib/goal-estimate-questions";
import { suggestDesiredMonthlyIncome } from "@/app/onboarding/_lib/onboarding-math";

const GOAL_TYPES = [
  "Retirement",
  "Financial freedom",
  "House purchase",
  "Car purchase",
  "Child education",
  "Higher education",
  "Marriage",
  "Travel",
  "Debt repayment",
  "Business/startup",
  "Wealth creation",
  "Other",
];

function blankGoal(priority: number): ProfileGoal {
  return {
    type: "",
    customName: "",
    priority,
    targetAmount: 0,
    currentAmount: 0,
    targetDate: "",
    paymentStyle: "lumpsum",
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
    notes: "",
    linkedHoldingIds: [],
  };
}

type Mode = { kind: "add" } | { kind: "edit"; index: number; goal: ProfileGoal };

export function GoalEditDialog({
  mode,
  trigger,
  onDelete,
}: {
  mode: Mode;
  trigger: React.ReactNode;
  onDelete?: () => void;
}) {
  const profile = useAuthStore((state) => state.profile);
  const token = useAuthStore((state) => state.token);
  const saveProfile = useAuthStore((state) => state.saveProfile);
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<ProfileGoal>(mode.kind === "edit" ? mode.goal : blankGoal((profile?.goals?.length || 0) + 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Not sure?" helpers, mirroring the onboarding goal planner.
  const [estimating, setEstimating] = useState(false);
  const [datePicking, setDatePicking] = useState(false);

  useEffect(() => {
    if (open) {
      setGoal(mode.kind === "edit" ? mode.goal : blankGoal((profile?.goals?.length || 0) + 1));
      setError(null);
      setEstimating(false);
      setDatePicking(false);
    }
  }, [open, mode, profile?.goals?.length]);

  const needsCustomName = goal.type === "Other";
  const isRetirementLike = goal.type === "Retirement" || goal.type === "Financial freedom";
  const isEmi = goal.paymentStyle === "emi";

  const valid = useMemo(() => {
    if (!goal.type) return false;
    if (needsCustomName && !goal.customName.trim()) return false;
    if (isRetirementLike) {
      if (goal.retirementInputType === "monthly" && goal.desiredMonthlyIncome <= 0) return false;
      if (goal.retirementInputType === "yearly" && goal.desiredYearlyIncome <= 0) return false;
      if (goal.retirementInputType === "corpus" && goal.targetAmount <= 0) return false;
    } else if (goal.targetAmount <= 0) return false;
    return true;
  }, [goal, needsCustomName, isRetirementLike]);

  async function handleSave() {
    if (!profile) {
      setError("No profile loaded. Complete onboarding first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const goals = [...(profile.goals || [])];
      if (mode.kind === "edit") goals[mode.index] = goal;
      else goals.push(goal);
      const nextProfile: OnboardingProfile = { ...profile, goals };
      await api.saveOnboarding(nextProfile, token, { partial: true });
      saveProfile(nextProfile, true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save goal.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (mode.kind !== "edit" || !profile) return;
    if (!window.confirm(`Delete the goal "${displayName(goal)}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const goals = (profile.goals || []).filter((_, index) => index !== mode.index);
      const nextProfile: OnboardingProfile = { ...profile, goals };
      await api.saveOnboarding(nextProfile, token, { partial: true });
      saveProfile(nextProfile, true);
      setOpen(false);
      onDelete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete goal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[min(720px,96vw)] overflow-y-auto p-0">
        <div className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-lg font-semibold text-foreground">
            {mode.kind === "edit" ? "Edit Goal" : "Add a new goal"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-muted-foreground">
            Tell us about this goal so the app can build a monthly plan around it.
          </DialogDescription>
        </div>

        {estimating && profile ? (
          <div className="p-6">
            <p className="text-sm font-semibold text-foreground">Estimate: {displayName(goal)}</p>
            <p className="mb-4 mt-1 text-xs text-muted-foreground">Answer a couple of quick questions and Papa will suggest a figure.</p>
            <GoalEstimateHelper
              goal={goal}
              profile={profile}
              onUse={(amount) => { setGoal({ ...goal, targetAmount: amount }); setEstimating(false); }}
              onBack={() => setEstimating(false)}
            />
          </div>
        ) : (
        <>
        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Goal type</Label>
              <Select value={goal.type} onValueChange={(value) => setGoal({ ...goal, type: value })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select a goal type" /></SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Priority</Label>
              <Input className="mt-1.5" type="number" min={1} value={goal.priority} onChange={(event) => setGoal({ ...goal, priority: Number(event.target.value || 1) })} />
            </div>
          </div>

          {needsCustomName ? (
            <div>
              <Label className="text-sm font-medium">Custom name</Label>
              <Input className="mt-1.5" value={goal.customName} onChange={(event) => setGoal({ ...goal, customName: event.target.value })} placeholder="e.g., Sabbatical fund" />
            </div>
          ) : null}

          {/* Retirement / Financial freedom input mode */}
          {isRetirementLike ? (
            <div className="rounded-xl bg-surface-soft p-4">
              <p className="text-sm font-semibold text-foreground">How would you like to plan this?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["corpus", "monthly"] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setGoal({ ...goal, retirementInputType: option })}
                    className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${goal.retirementInputType === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground hover:bg-surface-hover"}`}
                  >
                    {option === "corpus" ? "Lump-sum target" : "Desired monthly income"}
                  </button>
                ))}
              </div>
              {goal.retirementInputType === "monthly" ? (
                <CurrencyField
                  className="mt-3"
                  label="Desired monthly income at retirement"
                  value={goal.desiredMonthlyIncome}
                  onChange={(value) => setGoal({ ...goal, desiredMonthlyIncome: value })}
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        const suggested = suggestDesiredMonthlyIncome(profile || {});
                        if (suggested > 0) setGoal({ ...goal, desiredMonthlyIncome: suggested, retirementInputType: "monthly" });
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-accent px-2 py-0.5 text-[0.6875rem] font-semibold text-primary transition hover:border-primary"
                    >
                      <Sparkles className="h-3 w-3" /> Not sure?
                    </button>
                  }
                />
              ) : null}
              <div className="mt-3">
                <Label className="text-xs font-medium">Safe withdrawal rate (%)</Label>
                <Input type="number" className="mt-1.5" step={0.5} min={2} max={8} value={goal.withdrawalRate} onChange={(event) => setGoal({ ...goal, withdrawalRate: Number(event.target.value || 4) })} />
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyField
              label={isRetirementLike && goal.retirementInputType !== "corpus" ? "Calculated target (auto-estimated)" : "Target amount"}
              value={goal.targetAmount}
              onChange={(value) => setGoal({ ...goal, targetAmount: value })}
              action={profile ? <NotSureButton onClick={() => { if (!goal.type) { setError("Pick a goal type first, then Papa can estimate it."); return; } setEstimating(true); }} /> : null}
            />
            <CurrencyField label="Already saved" value={goal.currentAmount} onChange={(value) => setGoal({ ...goal, currentAmount: value })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">Target date</Label>
                <NotSureButton onClick={() => setDatePicking((v) => !v)} />
              </div>
              <Input className="mt-1.5" type="date" value={goal.targetDate} onChange={(event) => setGoal({ ...goal, targetDate: event.target.value })} />
            </div>
            <CurrencyField label="Planned monthly contribution" value={goal.monthlyContribution} onChange={(value) => setGoal({ ...goal, monthlyContribution: value })} />
          </div>

          {datePicking ? (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <p className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Not sure when? Pick a rough timeline
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">Papa will set a target date from this. You can fine tune it anytime.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {goalDateSuggestions(goal.type, profile || undefined).map((chip) => (
                  <button
                    key={`${chip.date}-${chip.label}`}
                    type="button"
                    onClick={() => { setGoal({ ...goal, targetDate: chip.date }); setDatePicking(false); }}
                    className="rounded-full border border-border bg-surface px-4 py-2 text-[0.875rem] font-medium text-foreground shadow-sm transition hover:border-primary hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Payment style */}
          <div>
            <Label className="text-sm font-medium">How will you fund this?</Label>
            <div className="mt-2 flex gap-2">
              {(["lumpsum", "emi"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setGoal({ ...goal, paymentStyle: style })}
                  className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${goal.paymentStyle === style ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground hover:bg-surface-hover"}`}
                >
                  {style === "lumpsum" ? "Save and pay" : "Take a loan / EMI"}
                </button>
              ))}
            </div>
          </div>

          {isEmi ? (
            <div className="grid gap-4 rounded-xl bg-surface-soft p-4 sm:grid-cols-3">
              <div>
                <Label className="text-xs font-medium">Interest rate (%)</Label>
                <Input className="mt-1.5" type="number" step={0.1} value={goal.interestRate} onChange={(event) => setGoal({ ...goal, interestRate: Number(event.target.value || 0) })} />
              </div>
              <div>
                <Label className="text-xs font-medium">Tenure (years)</Label>
                <Input className="mt-1.5" type="number" min={1} max={40} value={goal.tenureYears} onChange={(event) => setGoal({ ...goal, tenureYears: Number(event.target.value || 1) })} />
              </div>
              <CurrencyField label="Down payment" value={goal.downPayment} onChange={(value) => setGoal({ ...goal, downPayment: value })} />
            </div>
          ) : null}

          <div>
            <Label className="text-sm font-medium">Notes (optional)</Label>
            <Textarea className="mt-1.5 min-h-16" value={goal.notes} onChange={(event) => setGoal({ ...goal, notes: event.target.value })} placeholder="Anything you want to remember about this goal..." />
          </div>

          {error ? <p className="rounded-lg bg-negative-soft p-3 text-sm text-negative-foreground">{error}</p> : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {mode.kind === "edit" ? (
              <Button variant="ghost" onClick={handleDelete} disabled={saving} className="text-negative-foreground hover:bg-negative-soft">
                <Trash2 className="h-4 w-4" /> Delete goal
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={!valid || saving}>
              {saving ? "Saving..." : mode.kind === "edit" ? "Save changes" : "Add Goal"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NotSureButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-primary transition hover:border-primary hover:bg-primary/15"
    >
      <Sparkles className="h-3 w-3" /> Not sure?
    </button>
  );
}

function CurrencyField({ label, value, onChange, className, action }: { label: string; value: number; onChange: (value: number) => void; className?: string; action?: React.ReactNode }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        {action}
      </div>
      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-input bg-surface px-3">
        <IndianRupee className="h-4 w-4 text-muted-foreground" />
        <Input
          type="number"
          min={0}
          value={value || ""}
          placeholder="0"
          onChange={(event) => onChange(Number(event.target.value || 0))}
          className="border-0 px-0 focus-visible:ring-0"
        />
      </div>
    </div>
  );
}

function displayName(goal: ProfileGoal) {
  return goal.type === "Other" ? goal.customName || "Custom goal" : goal.type || "Goal";
}
