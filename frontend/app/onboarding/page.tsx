"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { api, ApiError } from "@/lib/api";
import { onboardingSchema } from "@/lib/schemas";
import { ageFromDob, currentBudgetMonth, normalizeProfileForForm, totalMonthlyEmi } from "@/lib/profile";
import { useAuthStore } from "@/store/auth-store";
import { OnboardingProfile } from "@/types";
import { OnboardingShell } from "./_components/onboarding-shell";
import { ScreenFrame } from "./_components/screen-frame";
import { buildScreens } from "./_flow/flow-config";
import { SECTIONS, ScreenDef } from "./_flow/types";
import { emptyGoal } from "./_screens/goals";
import { calculateMonthlyEmi, estimateInterestRate } from "./_lib/onboarding-math";

type FlowMode = "default" | "edit" | "goals";

export default function OnboardingPage() {
  const router = useRouter();
  const saveProfile = useAuthStore((state) => state.saveProfile);
  const existing = useAuthStore((state) => state.profile);
  const token = useAuthStore((state) => state.token);

  const [flowMode, setFlowMode] = useState<FlowMode>("default");
  const [screenIndex, setScreenIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  // Hydrate screenIndex from localStorage so a refresh keeps the user on the
  // same section instead of sending them back to Welcome.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("askpapa_onboarding_screen");
      if (stored) {
        const n = Number(stored);
        if (!Number.isNaN(n) && n >= 0) setScreenIndex(n);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Persist screenIndex on every change.
  useEffect(() => {
    try {
      window.localStorage.setItem("askpapa_onboarding_screen", String(screenIndex));
    } catch {
      /* ignore */
    }
  }, [screenIndex]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState("");
  const initializedFromQuery = useRef(false);
  const stepErrorRef = useRef<HTMLParagraphElement | null>(null);

  // Start each screen at the top — on mobile the user is usually scrolled to
  // the bottom (where Continue lives) when the next screen mounts.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screenIndex]);

  // Surface validation errors even when the card is taller than the viewport.
  useEffect(() => {
    if (stepError) {
      stepErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [stepError]);

  const form = useForm<OnboardingProfile>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: normalizeProfileForForm(existing),
    mode: "onBlur"
  });
  const values = useWatch({ control: form.control }) as OnboardingProfile;

  // Zustand `persist` rehydrates from localStorage asynchronously. If `existing`
  // arrives after the form has already mounted with `blankProfile`, reset the
  // form so the user sees their saved answers instead of an empty flow.
  const hasResetFromExistingRef = useRef(false);
  useEffect(() => {
    if (hasResetFromExistingRef.current) return;
    if (!existing) return;
    hasResetFromExistingRef.current = true;
    form.reset(normalizeProfileForForm(existing));
  }, [existing, form]);

  // Auto-derive age, total inflow, EMI totals
  useEffect(() => {
    const income = Number(values.monthlySalary || 0) + Number(values.otherIncome || 0);
    if (Number(values.monthlyCashInflow || 0) !== income) {
      form.setValue("monthlyCashInflow", income, { shouldValidate: false });
    }
  }, [values.monthlySalary, values.otherIncome, values.monthlyCashInflow, form]);

  useEffect(() => {
    const age = ageFromDob(values.dateOfBirth || "");
    if (Number(values.age || 0) !== age) {
      form.setValue("age", age, { shouldValidate: false });
    }
  }, [values.dateOfBirth, values.age, form]);

  useEffect(() => {
    const loans = values.emiLoans || [];
    const total = totalMonthlyEmi(loans);
    if (Number(values.emi || 0) !== total) {
      form.setValue("emi", total, { shouldValidate: false });
    }
    loans.forEach((loan, index) => {
      const monthlyEmi = calculateMonthlyEmi(loan);
      const estimatedRate = estimateInterestRate(loan);
      if (monthlyEmi && !Number(loan?.monthlyEmiAmount || 0)) {
        form.setValue(`emiLoans.${index}.monthlyEmiAmount`, monthlyEmi, { shouldValidate: false });
      }
      if (estimatedRate !== Number(loan?.estimatedInterestRate || 0)) {
        form.setValue(`emiLoans.${index}.estimatedInterestRate`, estimatedRate, { shouldValidate: false });
      }
    });
  }, [values.emiLoans, values.emi, form]);

  // Derive removed-question fields from related answers so the schema stays valid
  useEffect(() => {
    const lossToVolatility: Record<string, string> = {
      "0-5%": "Low", "5-10%": "Low", "10-15%": "Moderate", "15%+": "High"
    };
    const lossToPsychology: Record<string, string> = {
      "0-5%": "Stable returns",
      "5-10%": "Stable returns",
      "10-15%": "Balanced",
      "15%+": "Higher growth with more ups and downs"
    };
    // Panic-sell tendency is inferred from how big a long-term drawdown the user
    // can sit through (Risk section) — the "markets fall 10%" habit question was
    // removed as a duplicate of this signal.
    const drawdownToPanic: Record<string, string> = {
      "0-10%": "Often", "10-25%": "Sometimes", "25%+": "Rarely"
    };
    const loss = values.shortTermLossTolerance || "";
    const vol = lossToVolatility[loss] || values.shortTermVolatilityComfort || "";
    const psych = lossToPsychology[loss] || values.investmentPsychology || "";
    const panic = drawdownToPanic[values.drawdownTolerance || ""] || values.panicSellRisk || "";
    if (vol && vol !== values.shortTermVolatilityComfort) {
      form.setValue("shortTermVolatilityComfort", vol, { shouldValidate: false });
    }
    if (psych && psych !== values.investmentPsychology) {
      form.setValue("investmentPsychology", psych, { shouldValidate: false });
    }
    if (panic && panic !== values.panicSellRisk) {
      form.setValue("panicSellRisk", panic, { shouldValidate: false });
    }
  }, [values.shortTermLossTolerance, values.drawdownTolerance, values.shortTermVolatilityComfort, values.investmentPsychology, values.panicSellRisk, form]);

  // Handle query-param entrypoints
  useEffect(() => {
    if (initializedFromQuery.current) return;
    initializedFromQuery.current = true;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode === "edit" && existing) {
      setFlowMode("edit");
      setScreenIndex(0);
    } else if (mode === "goals") {
      setFlowMode("goals");
      setScreenIndex(0);
      if (params.get("add") === "1") {
        const currentGoals = form.getValues("goals") || [];
        form.setValue("goals", [...currentGoals, emptyGoal(currentGoals.length + 1)], { shouldValidate: false });
      }
    }
  }, [existing, form]);

  const screens = useMemo(() => {
    if (flowMode === "goals") {
      return buildScreens(values, { goalsOnly: true });
    }
    return buildScreens(values, { skipWelcome: flowMode === "edit", skipCelebrate: flowMode === "edit" });
  }, [values, flowMode]);

  const safeIndex = Math.min(Math.max(screenIndex, 0), Math.max(screens.length - 1, 0));
  const current: ScreenDef | undefined = screens[safeIndex];
  const currentSectionIdx = current ? SECTIONS.findIndex((s) => s.id === current.sectionId) : 0;
  const currentSectionLabel = SECTIONS[currentSectionIdx]?.label || "";

  const isFirst = safeIndex === 0;
  const isLast = safeIndex === screens.length - 1;
  const isCelebrate = current?.id === "celebrate";

  const persistDraft = async () => {
    setSaveState("saving");
    const snapshot = form.getValues();
    // Guard against wiping a saved profile with a blank draft. This can happen
    // on a slow store-hydrate where the form still holds blankProfile when the
    // user clicks "Continue". We only save once the user has actually answered
    // *something* meaningful.
    const hasAnyInput =
      Boolean(snapshot.name?.trim()) ||
      Boolean(snapshot.dateOfBirth) ||
      Number(snapshot.monthlySalary || 0) > 0 ||
      Number(snapshot.monthlyExpenses || 0) > 0 ||
      (snapshot.goals?.length || 0) > 0 ||
      (snapshot.holdings?.length || 0) > 0 ||
      (snapshot.emiLoans?.length || 0) > 0;
    if (!hasAnyInput) {
      setSaveState("idle");
      return;
    }
    saveProfile(snapshot, false);
    try {
      await api.saveOnboarding(snapshot, token, { partial: true });
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1400);
    } catch {
      setSaveState("idle");
    }
  };

  const finalSubmit = async () => {
    setSubmitting(true);
    setStepError("");
    try {
      const valuesToSubmit = form.getValues();
      const normalized: OnboardingProfile = {
        ...valuesToSubmit,
        age: ageFromDob(valuesToSubmit.dateOfBirth),
        bonusIncome: 0,
        sideIncome: 0,
        monthlyCashInflow: valuesToSubmit.monthlySalary + valuesToSubmit.otherIncome,
        incomeStructureVersion: 2,
        emi: totalMonthlyEmi(valuesToSubmit.emiLoans),
        volatilityComfort: valuesToSubmit.shortTermVolatilityComfort,
        // Stamp the "invest this month" override with the current month so the
        // dashboard applies it right away (the backend stamps the same way).
        investableThisMonthMonth: Number(valuesToSubmit.investableThisMonth || 0) > 0 ? currentBudgetMonth() : ""
      };
      await api.saveOnboarding(normalized, token);
      saveProfile(normalized, true);
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        setStepError(error.detail);
      } else {
        setStepError(error instanceof Error ? error.message : "Save failed");
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  async function goNext() {
    setStepError("");
    if (!current) return;

    // Celebrate screen → exit to dashboard
    if (isCelebrate) {
      try { window.localStorage.removeItem("askpapa_onboarding_screen"); } catch { /* ignore */ }
      router.push("/dashboard");
      return;
    }

    // Per-screen validation
    if (current.fields?.length) {
      const ok = await form.trigger(current.fields, { shouldFocus: true });
      if (!ok) {
        setStepError("Please answer the highlighted fields to continue.");
        return;
      }
    }

    // Special: income screen needs at least some inflow
    if (current.id === "income" && Number(form.getValues("monthlyCashInflow") || 0) <= 0) {
      setStepError("Enter at least one income source so total inflow is greater than zero.");
      return;
    }

    // Special: if user says they have loans, at least one complete loan/EMI row is required.
    if (current.id === "loans") {
      const hasEmiLoans = form.getValues("hasEmiLoans");
      const loans = form.getValues("emiLoans") || [];
      if (hasEmiLoans !== false && loans.length === 0) {
        setStepError("Add your loan or EMI details, or choose “No loans right now” to continue.");
        return;
      }
    }

    // Special: goals screen needs at least one goal
    if (current.id === "goals" && (form.getValues("goals") || []).length === 0) {
      setStepError("Pick at least one goal to continue.");
      return;
    }

    const isLastDataScreen = (flowMode === "default" && safeIndex === screens.length - 2)
      || (flowMode === "edit" && safeIndex === screens.length - 1)
      || (flowMode === "goals" && safeIndex === screens.length - 1);

    if (flowMode === "default" && isLastDataScreen) {
      const success = await finalSubmit();
      if (success) {
        setDirection(1);
        setScreenIndex(safeIndex + 1); // advance to celebrate
      }
      return;
    }

    if (flowMode === "edit" && isLastDataScreen) {
      const success = await finalSubmit();
      if (success) router.push("/dashboard");
      return;
    }

    if (flowMode === "goals" && isLastDataScreen) {
      const success = await finalSubmit();
      if (success) router.push("/goals");
      return;
    }

    // Fire-and-forget draft save
    persistDraft();

    // Advance, skipping screens that match shouldSkip
    let next = safeIndex + 1;
    while (next < screens.length && screens[next].shouldSkip?.(form.getValues())) {
      next += 1;
    }
    if (next < screens.length) {
      setDirection(1);
      setScreenIndex(next);
    }
  }

  function goBack() {
    setStepError("");
    let prev = safeIndex - 1;
    while (prev >= 0 && screens[prev].shouldSkip?.(form.getValues())) {
      prev -= 1;
    }
    if (prev >= 0) {
      setDirection(-1);
      setScreenIndex(prev);
    }
  }

  // Enter advances the flow, so keyboard users never have to reach for the
  // Continue button. Skipped inside dialogs/popovers and on focused buttons
  // (where Enter already has its own meaning).
  const goNextRef = useRef<() => Promise<void>>(async () => {});
  goNextRef.current = goNext;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "TEXTAREA" || tag === "BUTTON" || tag === "A" || tag === "SELECT") return;
        if (target.closest('[role="dialog"],[role="listbox"],[role="menu"],[role="combobox"]')) return;
      }
      event.preventDefault();
      void goNextRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!current) return null;

  return (
    <FormProvider {...form}>
      <OnboardingShell
        sections={SECTIONS}
        activeSectionIndex={Math.max(currentSectionIdx, 0)}
        sectionLabel={currentSectionLabel}
        saveState={saveState}
        onSaveDraft={!isCelebrate ? persistDraft : undefined}
        onBack={isFirst ? undefined : goBack}
        onNext={goNext}
        onExit={flowMode === "edit" ? () => router.push("/dashboard") : undefined}
        isFirst={isFirst}
        isLast={isCelebrate}
        submitting={submitting}
        nextLabel={current.nextLabel}
      >
        <ScreenFrame screenKey={current.id} direction={direction}>
          {(() => {
            const ScreenRenderer = current.render as React.ComponentType<{ form: typeof form; values: OnboardingProfile; next: () => Promise<void>; back: () => void }>;
            return <ScreenRenderer form={form} values={values} next={goNext} back={goBack} />;
          })()}
        </ScreenFrame>
        {stepError ? <p ref={stepErrorRef} className="mt-5 text-sm font-medium text-negative-foreground">{stepError}</p> : null}
      </OnboardingShell>
    </FormProvider>
  );
}
