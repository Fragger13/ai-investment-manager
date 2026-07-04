"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, GoalEstimate } from "@/lib/api";
import { formatINR } from "@/lib/currency";
import { OnboardingProfile, ProfileGoal } from "@/types";
import { PapaAvatar } from "../_components/papa-bubble";
import { EstimateQuestion, questionsFor, usesWhenYears, WHEN_QUESTION, whenYearsFromDate } from "../_lib/goal-estimate-questions";

/**
 * A focused Papa-styled AI chat that helps a user who doesn't know a goal's
 * target amount. It asks a few quick-reply questions, calls the hybrid estimate
 * endpoint, and hands a number back via `onUse` to fill the Target amount field.
 */
export function GoalEstimateHelper({
  goal,
  profile,
  onUse,
  onBack,
}: {
  goal: ProfileGoal;
  profile: OnboardingProfile;
  onUse: (amount: number) => void;
  onBack: () => void;
}) {
  const goalType = goal.type;
  const isOther = goalType === "Other";
  const presetWhen = useMemo(() => whenYearsFromDate(goal.targetDate), [goal.targetDate]);

  // Non-"Other" goals use a fixed chip set. "Other" is built dynamically: first
  // we find out what the goal is, then the AI tailors the clarifying questions.
  const buildInitial = (): EstimateQuestion[] => {
    if (isOther) {
      return goal.customName
        ? []
        : [{ key: "description", kind: "text", prompt: "What are you saving for?", placeholder: "e.g., an Apple Watch, a new laptop, parents' healthcare", chips: [] }];
    }
    const qs = [...questionsFor(goalType)];
    if (usesWhenYears(goalType) && !presetWhen) qs.push(WHEN_QUESTION);
    return qs;
  };

  const [questions, setQuestions] = useState<EstimateQuestion[]>(buildInitial);
  const [answers, setAnswers] = useState<Record<string, string>>(isOther && goal.customName ? { description: goal.customName } : {});
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [clarifying, setClarifying] = useState(isOther && Boolean(goal.customName));
  const [estimate, setEstimate] = useState<GoalEstimate | null>(null);
  const [error, setError] = useState("");
  const [restartKey, setRestartKey] = useState(0);

  const goalLabel = isOther ? answers.description || goal.customName || "this goal" : goalType.toLowerCase();

  const runEstimate = async (finalAnswers: Record<string, string>) => {
    setLoading(true);
    setError("");
    const payload: Record<string, string> = { ...finalAnswers };
    if (presetWhen) payload.whenYears = presetWhen;
    try {
      const result = await api.estimateGoal(goalType, payload, profile);
      setEstimate(result);
    } catch {
      setError("Papa couldn't work it out just now. Try again, or type an amount yourself.");
    } finally {
      setLoading(false);
    }
  };

  // For "Other", fetch AI clarifying questions once we know what the goal is.
  // Keyed on the description string (+ restartKey), so it fires whether the user
  // typed it here or pre-filled "What are you saving for?" on the form. No fetch
  // guard ref: under React Strict Mode the mount effect runs twice and a ref
  // guard would let the first (discarded) run win and hang the loader — the
  // `active` cleanup already makes the live invocation win, and the backend
  // caches by description so the extra dev call is a cache hit.
  useEffect(() => {
    if (!isOther) return;
    const description = (answers.description || goal.customName || "").trim();
    if (!description) return;
    setClarifying(true);
    let active = true;
    api.clarifyGoal(description, profile)
      .then((res) => {
        if (!active) return;
        const dynamic: EstimateQuestion[] = (res.questions || []).map((q) => ({ key: q.key, prompt: q.prompt, chips: q.options }));
        const tail: EstimateQuestion[] = presetWhen ? [] : [WHEN_QUESTION];
        if (dynamic.length === 0 && tail.length === 0) {
          void runEstimate({ ...answers, description });
        } else {
          setQuestions((prev) => [...prev, ...dynamic, ...tail]);
        }
      })
      .catch(() => {
        if (active) void runEstimate({ ...answers, description });
      })
      .finally(() => {
        if (active) setClarifying(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOther, answers.description, goal.customName, presetWhen, restartKey]);

  const choose = (key: string, value: string) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (isOther && key === "description") {
      // The clarify effect (triggered by answers.description) appends the tailored
      // questions — don't estimate yet.
      setStepIndex((index) => index + 1);
      setClarifying(true);
      return;
    }
    if (stepIndex + 1 < questions.length) {
      setStepIndex(stepIndex + 1);
    } else {
      void runEstimate(next);
    }
  };

  const restart = () => {
    setQuestions(buildInitial());
    setAnswers(isOther && goal.customName ? { description: goal.customName } : {});
    setStepIndex(0);
    setEstimate(null);
    setError("");
    setClarifying(isOther && Boolean(goal.customName));
    setRestartKey((key) => key + 1);
  };

  const current = questions[stepIndex];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-[#4B5563] hover:text-[#0F172A]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to the form
      </button>

      <div className="flex items-start gap-3">
        <PapaAvatar avatarClass="h-12 w-12" mood={estimate ? "proud" : "thoughtful"} />
        <div className="min-w-0 flex-1 space-y-3">
          {estimate ? (
            <EstimateResult estimate={estimate} goalLabel={goalLabel} onUse={onUse} onRetry={restart} />
          ) : loading ? (
            <Bubble>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#138A3C]" /> Papa&apos;s working it out…
              </span>
            </Bubble>
          ) : error ? (
            <div className="space-y-2">
              <Bubble>{error}</Bubble>
              <Button type="button" variant="outline" size="sm" onClick={restart}>
                <RotateCcw className="h-3.5 w-3.5" /> Start over
              </Button>
            </div>
          ) : clarifying ? (
            <Bubble>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#138A3C]" /> Papa&apos;s thinking about what to ask…
              </span>
            </Bubble>
          ) : current ? (
            <div className="space-y-2.5">
              {!isOther ? (
                <p className="text-[12px] font-medium text-[#9CA3AF]">
                  Question {stepIndex + 1} of {questions.length}
                </p>
              ) : null}
              <Bubble>{current.prompt}</Bubble>
              {current.kind === "text" ? (
                <TextStep
                  key={stepIndex}
                  placeholder={current.placeholder}
                  onSubmit={(value) => choose(current.key, value)}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {current.chips.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => choose(current.key, chip.value)}
                      className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-[14px] font-medium text-[#0F172A] shadow-sm transition hover:-translate-y-0.5 hover:border-[#138A3C] hover:bg-[#F8FAF9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C]"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TextStep({ placeholder, onSubmit }: { placeholder?: string; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");
  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        className="max-w-[300px] flex-1 text-[15px]"
      />
      <Button type="button" size="sm" className="bg-[#138A3C] text-white hover:bg-[#107132]" disabled={!value.trim()} onClick={submit}>
        Continue
      </Button>
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative inline-block max-w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-[15px] leading-snug text-[#0F172A] shadow-sm">
      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 border-b border-l border-[#E5E7EB] bg-white" aria-hidden />
      {children}
    </div>
  );
}

function EstimateResult({
  estimate,
  goalLabel,
  onUse,
  onRetry,
}: {
  estimate: GoalEstimate;
  goalLabel: string;
  onUse: (amount: number) => void;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#138A3C]/25 bg-[#E9F4EC] p-4">
      <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#138A3C]">
        <Sparkles className="h-3.5 w-3.5" /> Papa&apos;s estimate for {goalLabel}
      </p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-[#0F172A]">{formatINR(estimate.amount)}</p>
      <p className="mt-0.5 text-[13px] text-[#4B5563]">
        Likely somewhere between {formatINR(estimate.low)} and {formatINR(estimate.high)}.
      </p>
      <p className="mt-2 text-[13px] leading-5 text-[#374151]">{estimate.rationale}</p>
      {estimate.assumptions?.length ? (
        <p className="mt-1.5 text-[12px] text-[#6B7280]">Based on: {estimate.assumptions.join(" · ")}.</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" className="bg-[#138A3C] text-white hover:bg-[#107132]" onClick={() => onUse(estimate.amount)}>
          Use this amount
        </Button>
        <Button type="button" variant="outline" onClick={onRetry}>
          <RotateCcw className="h-3.5 w-3.5" /> Adjust answers
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-[#9CA3AF]">A rough starting point, not a quote. You can always edit it.</p>
    </div>
  );
}
