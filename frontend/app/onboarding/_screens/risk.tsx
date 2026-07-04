"use client";

import { useEffect, useRef } from "react";
import { NumberField, fieldError } from "../_lib/field-helpers";
import { HelpHint } from "../_lib/help-hint";
import { OptionPill } from "../_components/choice-card";
import { ScreenWrap } from "./about";
import { ScreenContext } from "../_flow/types";
import { OnboardingProfile } from "@/types";

type ChoiceField = keyof Pick<OnboardingProfile, "drawdownTolerance" | "investmentHorizon">;

type Option = { value: string; title: string; emoji: string };

// Newbies found the old 5-question risk grid intimidating, so we ask just the
// two that actually move the needle on sizing: how you'd react to a dip, and how
// long your money stays invested. The other signals the engine needs (short-term
// loss tolerance, short-term horizon, opportunity appetite) are derived from
// these below, so nothing downstream loses its input. Options render as pills
// that wrap to as many lines as needed, matching the money-habits screen.
const RISK_QUESTIONS: { field: ChoiceField; question: string; hint: string; options: Option[] }[] = [
  {
    field: "drawdownTolerance",
    question: "Imagine you invested ₹10,000 and a few months later it became ₹9,000. What would you most likely do?",
    hint: "There's no right answer here. It just helps Papa understand how you feel when markets wobble, so the suggestions match your comfort.",
    options: [
      { value: "0-10%", title: "I'd rather move my money somewhere safer", emoji: "🛡️" },
      { value: "10-25%", title: "I'd wait and see if it recovers", emoji: "🧘" },
      { value: "25%+", title: "I'd keep investing because I believe it'll grow over time", emoji: "🌱" }
    ]
  },
  {
    field: "investmentHorizon",
    question: "How long can you leave this money invested without needing it?",
    hint: "Roughly how long before you'll actually spend this money. The longer it can stay put, the more it can grow through the ups and downs.",
    options: [
      { value: "1-3 years", title: "1-3 years", emoji: "⚡" },
      { value: "3-5 years", title: "3-5 years", emoji: "🪴" },
      { value: "7-10 years", title: "7-10 years", emoji: "🌲" },
      { value: "10+ years", title: "10+ years", emoji: "🏔️" }
    ]
  }
];

// Map the two answers onto the finer-grained risk fields the recommendation
// engine and schema still expect. Volatility comfort, investing psychology and
// panic-sell risk are derived one more step on, in the onboarding page effect.
const DRAWDOWN_TO_LOSS: Record<string, string> = { "0-10%": "0-5%", "10-25%": "5-10%", "25%+": "10-15%" };
const DRAWDOWN_TO_OPPORTUNITY: Record<string, string> = {
  "0-10%": "Fewer high-confidence calls",
  "10-25%": "Balanced",
  "25%+": "Frequent opportunities"
};
const DEFAULT_SHORT_TERM_HORIZON = "6-12 months";

export function RiskScreen(ctx: ScreenContext) {
  const years = Math.max(60 - Number(ctx.values.age || 0), 0);
  const { errors } = ctx.form.formState;
  const erroredFields = RISK_QUESTIONS
    .map((q) => q.field)
    .filter((field) => Boolean(fieldError(errors as Record<string, unknown>, field)));
  useScrollToFirstError(erroredFields);
  const answered = RISK_QUESTIONS.filter((q) => Boolean(ctx.values[q.field])).length;
  const selectAnswer = (field: ChoiceField, value: string) => {
    ctx.form.setValue(field, value, { shouldValidate: true });
    scrollToNextUnanswered(RISK_QUESTIONS.map((q) => q.field), field, (f) => f === field ? value : String(ctx.values[f as ChoiceField] || ""));
  };

  // Keep the derived (now-hidden) risk fields in sync so isOnboardingComplete and
  // the submit schema stay satisfied with only two visible questions answered.
  const { setValue } = ctx.form;
  const drawdown = ctx.values.drawdownTolerance || "";
  const loss = ctx.values.shortTermLossTolerance || "";
  const opp = ctx.values.opportunityPreference || "";
  const shortHorizon = ctx.values.shortTermHorizon || "";
  useEffect(() => {
    const wantLoss = DRAWDOWN_TO_LOSS[drawdown] || "";
    const wantOpp = DRAWDOWN_TO_OPPORTUNITY[drawdown] || "";
    if (wantLoss && wantLoss !== loss) setValue("shortTermLossTolerance", wantLoss, { shouldValidate: false });
    if (wantOpp && wantOpp !== opp) setValue("opportunityPreference", wantOpp, { shouldValidate: false });
    if (!shortHorizon) setValue("shortTermHorizon", DEFAULT_SHORT_TERM_HORIZON, { shouldValidate: false });
  }, [drawdown, loss, opp, shortHorizon, setValue]);

  return (
    <ScreenWrap
      papa="Almost there, beta. Two quick gut checks, no wrong answers, and nobody gets extra marks for being a hero."
      headline="How you feel about risk"
      sub="Just two questions, and Papa will size every suggestion to match your comfort."
      mood="gentle"
      badge={<AnsweredBadge answered={answered} total={RISK_QUESTIONS.length} />}
    >
      <div className="space-y-8">
        <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-2">
          {RISK_QUESTIONS.map((q) => (
            <QuestionRow
              key={q.field}
              field={q.field}
              question={q.question}
              hint={q.hint}
              options={q.options}
              value={ctx.values[q.field] as string | undefined}
              error={erroredFields.includes(q.field)}
              onSelect={(value) => selectAnswer(q.field, value)}
            />
          ))}
        </div>
        <RetirementBlock years={years} />
      </div>
    </ScreenWrap>
  );
}

// Live progress chip next to the headline: fills green once every pill
// question on the screen is answered.
export function AnsweredBadge({ answered, total }: { answered: number; total: number }) {
  const done = answered >= total;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold transition ${
        done
          ? "border-[#138A3C] bg-[#138A3C] text-white"
          : "border-[#E5E7EB] bg-white text-[#4B5563]"
      }`}
    >
      {done ? "✓ All answered" : `${answered}/${total} answered`}
    </span>
  );
}

// After a pill is tapped, glide to the next unanswered question so the screen
// reads tap → next → tap. Skipped when the next question is already fully
// visible (desktop), so the page never jiggles.
export function scrollToNextUnanswered(
  fields: string[],
  justAnswered: string,
  valueOf: (field: string) => string
) {
  window.setTimeout(() => {
    const idx = fields.indexOf(justAnswered);
    const ordered = [...fields.slice(idx + 1), ...fields.slice(0, idx)];
    const next = ordered.find((field) => !valueOf(field));
    if (!next) return;
    const el = document.getElementById(`question-${next}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!fullyVisible) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 150);
}

// Pill questions are not real inputs, so react-hook-form's shouldFocus cannot
// reach them — scroll the first unanswered question into view ourselves when
// a failed Continue adds new errors.
export function useScrollToFirstError(erroredFields: string[]) {
  const prevCount = useRef(0);
  useEffect(() => {
    if (erroredFields.length > prevCount.current && erroredFields.length > 0) {
      document.getElementById(`question-${erroredFields[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    prevCount.current = erroredFields.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erroredFields.join(",")]);
}

function RetirementBlock({ years }: { years: number }) {
  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-1.5 text-base font-medium text-[#0F172A]">
        <span>When would you like to retire?<span className="ml-1 text-red-500" aria-hidden>*</span></span>
        <HelpHint text="The age you'd like to stop working for money, or make it optional. Most people pick around 60, but earlier is fine if that's your goal. Papa just needs it to plan how long your savings must last." label="retirement age" />
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-28">
          <NumberField name="retirementAge" placeholder="60" />
        </div>
        <p className="flex-1 text-[13px] text-[#4B5563]">
          {years ? `About ${years} years from now feels right for many, but you decide.` : "Used to plan how long your money needs to last."}
        </p>
      </div>
    </div>
  );
}

function QuestionRow({
  field,
  question,
  hint,
  options,
  value,
  error = false,
  onSelect
}: {
  field: string;
  question: string;
  hint?: string;
  options: Option[];
  value?: string;
  error?: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <div id={`question-${field}`} className={`space-y-2.5 rounded-xl transition ${error ? "-m-2 bg-red-50/60 p-2 ring-1 ring-red-300" : ""}`}>
      <p className={`flex items-start gap-1.5 text-base font-medium ${error ? "text-red-600" : "text-[#0F172A]"}`}>
        <span>{question}<span className="ml-1 text-red-500" aria-hidden>*</span></span>
        {hint ? <HelpHint text={hint} label="this question" /> : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <OptionPill
            key={option.value}
            label={option.title}
            emoji={option.emoji}
            selected={value === option.value}
            onSelect={() => onSelect(option.value)}
          />
        ))}
      </div>
      {error ? <p className="text-[13px] font-medium text-red-600">Pick one to continue</p> : null}
    </div>
  );
}
