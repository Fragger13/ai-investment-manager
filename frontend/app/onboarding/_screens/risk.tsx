"use client";

import { useEffect, useRef } from "react";
import { NumberField, fieldError } from "../_lib/field-helpers";
import { OptionPill } from "../_components/choice-card";
import { ScreenWrap } from "./about";
import { ScreenContext } from "../_flow/types";
import { OnboardingProfile } from "@/types";

type ChoiceField = keyof Pick<
  OnboardingProfile,
  "shortTermLossTolerance" | "shortTermHorizon" | "drawdownTolerance" | "investmentHorizon" | "opportunityPreference"
>;

type Option = { value: string; title: string; emoji: string };

const RISK_QUESTIONS: { field: ChoiceField; question: string; options: Option[] }[] = [
  {
    field: "shortTermLossTolerance",
    question: "If your short-term savings dipped a bit, how much fall could you shrug off?",
    options: [
      { value: "0-5%", title: "Up to 5%", emoji: "😌" },
      { value: "5-10%", title: "Up to 10%", emoji: "😐" },
      { value: "10-15%", title: "Up to 15%", emoji: "🙂" },
      { value: "15%+", title: "More than 15%", emoji: "😎" }
    ]
  },
  {
    field: "shortTermHorizon",
    question: "When investing for the short term, how long can you stay invested before needing the money?",
    options: [
      { value: "Less than 3 months", title: "Under 3 months", emoji: "⚡" },
      { value: "3-6 months", title: "3 to 6 months", emoji: "🌱" },
      { value: "6-12 months", title: "6 to 12 months", emoji: "🌾" },
      { value: "1-2 years", title: "1 to 2 years", emoji: "🌳" }
    ]
  },
  {
    field: "drawdownTolerance",
    question: "Your long-term investments drop temporarily. How big a dip can you sit through calmly?",
    options: [
      { value: "0-10%", title: "Up to 10%", emoji: "🛡️" },
      { value: "10-25%", title: "10 to 25%", emoji: "🧘" },
      { value: "25%+", title: "25% or more", emoji: "🦁" }
    ]
  },
  {
    field: "investmentHorizon",
    question: "How long will long-term money stay invested?",
    options: [
      { value: "1-3 years", title: "1 to 3 years", emoji: "⏳" },
      { value: "3-5 years", title: "3 to 5 years", emoji: "🪴" },
      { value: "7-10 years", title: "7 to 10 years", emoji: "🌲" },
      { value: "10+ years", title: "10+ years", emoji: "🏔️" }
    ]
  },
  {
    field: "opportunityPreference",
    question: "What kind of opportunities do you prefer to act on?",
    options: [
      { value: "Fewer high-confidence calls", title: "Fewer, high-confidence", emoji: "🎯" },
      { value: "Balanced", title: "A balanced mix", emoji: "⚖️" },
      { value: "Frequent opportunities", title: "Lots of opportunities", emoji: "🌊" }
    ]
  }
];

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
  return (
    <ScreenWrap
      papa="More than halfway, beta. And remember — this isn't an exam. Nobody gets extra marks for bravery."
      headline="Your risk profile"
      sub="Pick what fits — we'll size every recommendation to match."
      mood="gentle"
      badge={<AnsweredBadge answered={answered} total={RISK_QUESTIONS.length} />}
    >
      <div className="grid min-h-0 flex-1 gap-x-10 gap-y-5 lg:grid-cols-2">
        <div className="flex flex-col gap-12">
          {RISK_QUESTIONS.slice(0, 3).map((q) => (
            <QuestionRow
              key={q.field}
              field={q.field}
              question={q.question}
              options={q.options}
              value={ctx.values[q.field] as string | undefined}
              error={erroredFields.includes(q.field)}
              onSelect={(value) => selectAnswer(q.field, value)}
            />
          ))}
        </div>
        <div className="flex flex-col gap-12">
          {RISK_QUESTIONS.slice(3).map((q) => (
            <QuestionRow
              key={q.field}
              field={q.field}
              question={q.question}
              options={q.options}
              value={ctx.values[q.field] as string | undefined}
              error={erroredFields.includes(q.field)}
              onSelect={(value) => selectAnswer(q.field, value)}
            />
          ))}
          <RetirementBlock years={years} />
        </div>
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
      <p className="text-base font-medium text-[#0F172A]">When would you like to retire?<span className="ml-1 text-red-500" aria-hidden>*</span></p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-28">
          <NumberField name="retirementAge" placeholder="60" />
        </div>
        <p className="flex-1 text-[13px] text-[#4B5563]">
          {years ? `About ${years} years from now feels right for many — but you decide.` : "Used to plan how long your money needs to last."}
        </p>
      </div>
    </div>
  );
}

function QuestionRow({
  field,
  question,
  options,
  value,
  error = false,
  onSelect
}: {
  field: string;
  question: string;
  options: Option[];
  value?: string;
  error?: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <div id={`question-${field}`} className={`space-y-2.5 rounded-xl transition ${error ? "-m-2 bg-red-50/60 p-2 ring-1 ring-red-300" : ""}`}>
      <p className={`text-base font-medium ${error ? "text-red-600" : "text-[#0F172A]"}`}>
        {question}<span className="ml-1 text-red-500" aria-hidden>*</span>
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
