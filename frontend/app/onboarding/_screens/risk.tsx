"use client";

import { NumberField } from "../_lib/field-helpers";
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
    question: "Short term — how much of a dip would still feel okay?",
    options: [
      { value: "0-5%", title: "Up to 5%", emoji: "😌" },
      { value: "5-10%", title: "Up to 10%", emoji: "😐" },
      { value: "10-15%", title: "Up to 15%", emoji: "🙂" },
      { value: "15%+", title: "More than 15%", emoji: "😎" }
    ]
  },
  {
    field: "shortTermHorizon",
    question: "For short-term money, how long can it stay parked?",
    options: [
      { value: "Less than 3 months", title: "Under 3 months", emoji: "⚡" },
      { value: "3-6 months", title: "3 to 6 months", emoji: "🌱" },
      { value: "6-12 months", title: "6 to 12 months", emoji: "🌾" },
      { value: "1-2 years", title: "1 to 2 years", emoji: "🌳" }
    ]
  },
  {
    field: "drawdownTolerance",
    question: "For long-term money, how much temporary drop can you stomach?",
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
  return (
    <ScreenWrap
      papa="This isn't an exam. Nobody gets extra marks for bravery."
      headline="Your risk profile"
      sub="Pick what fits — we'll size every recommendation to match."
      mood="gentle"
    >
      <div className="grid min-h-0 flex-1 gap-x-10 gap-y-5 lg:grid-cols-2">
        <div className="flex flex-col gap-[calc(1.5rem+0.7cm)]">
          {RISK_QUESTIONS.slice(0, 3).map((q) => (
            <QuestionRow
              key={q.field}
              question={q.question}
              options={q.options}
              value={ctx.values[q.field] as string | undefined}
              onSelect={(value) => ctx.form.setValue(q.field, value, { shouldValidate: true })}
            />
          ))}
        </div>
        <div className="flex flex-col gap-[calc(1.5rem+0.7cm)]">
          {RISK_QUESTIONS.slice(3).map((q) => (
            <QuestionRow
              key={q.field}
              question={q.question}
              options={q.options}
              value={ctx.values[q.field] as string | undefined}
              onSelect={(value) => ctx.form.setValue(q.field, value, { shouldValidate: true })}
            />
          ))}
          <RetirementBlock years={years} />
        </div>
      </div>
    </ScreenWrap>
  );
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
  question,
  options,
  value,
  onSelect
}: {
  question: string;
  options: Option[];
  value?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-base font-medium text-[#0F172A]">{question}<span className="ml-1 text-red-500" aria-hidden>*</span></p>
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
    </div>
  );
}
