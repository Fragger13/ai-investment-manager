"use client";

import { OptionPill } from "../_components/choice-card";
import { ScreenWrap } from "./about";
import { ScreenContext } from "../_flow/types";
import { OnboardingProfile } from "@/types";

type HabitField = keyof Pick<
  OnboardingProfile,
  "spendingDiscipline" | "emotionalSpendingTendency" | "riskReaction" | "tracksExpenses" | "investsMonthly" | "investingBlocker"
>;

type Option = { value: string; title: string; emoji: string };

const HABIT_QUESTIONS: { field: HabitField; question: string; options: Option[] }[] = [
  {
    field: "spendingDiscipline",
    question: "How well do you stick to a monthly budget?",
    options: [
      { value: "Low", title: "Often overspend", emoji: "🙈" },
      { value: "Medium", title: "Mixed", emoji: "🙂" },
      { value: "High", title: "Tight control", emoji: "💪" }
    ]
  },
  {
    field: "emotionalSpendingTendency",
    question: "Do shopping urges ever take over?",
    options: [
      { value: "Rarely", title: "Rarely", emoji: "🧘" },
      { value: "Sometimes", title: "Sometimes", emoji: "🛍️" },
      { value: "Often", title: "Often", emoji: "🎢" }
    ]
  },
  {
    field: "tracksExpenses",
    question: "Do you actually track where your money goes?",
    options: [
      { value: "Rarely", title: "Rarely", emoji: "📂" },
      { value: "Sometimes", title: "Sometimes", emoji: "📝" },
      { value: "Often", title: "Every month", emoji: "📊" }
    ]
  },
  {
    field: "investsMonthly",
    question: "Do you invest something every month?",
    options: [
      { value: "Rarely", title: "Rarely", emoji: "🌪️" },
      { value: "Sometimes", title: "Sometimes", emoji: "🌤️" },
      { value: "Often", title: "Like clockwork", emoji: "📆" }
    ]
  },
  {
    field: "riskReaction",
    question: "Markets fall 10% in one week. Your move?",
    options: [
      { value: "I stay calm", title: "Stay calm", emoji: "😌" },
      { value: "I get worried", title: "Get worried", emoji: "😟" },
      { value: "I may sell", title: "Might sell", emoji: "😰" }
    ]
  },
  {
    field: "investingBlocker",
    question: "What usually stops you from investing more?",
    options: [
      { value: "Nothing right now", title: "Nothing right now", emoji: "🌈" },
      { value: "Irregular income", title: "Irregular income", emoji: "📉" },
      { value: "Unexpected expenses", title: "Surprise expenses", emoji: "🛠️" },
      { value: "I forget or delay", title: "I forget or delay", emoji: "🕒" },
      { value: "Fear of losses", title: "Fear of losses", emoji: "😨" },
      { value: "Too many choices", title: "Too many choices", emoji: "🤯" }
    ]
  }
];

export function HabitsScreen(ctx: ScreenContext) {
  return (
    <ScreenWrap
      papa="Let's find out if you're Warren Buffett or 'Add to Cart' Buffett."
      headline="Your money habits"
      sub="Pick the option closest to how you usually act."
      mood="laugh"
    >
      <div className="grid min-h-0 flex-1 gap-x-10 gap-y-5 lg:grid-cols-2">
        <div className="flex flex-col gap-[calc(1.5rem+0.7cm)]">
          {HABIT_QUESTIONS.slice(0, 3).map((q) => (
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
          {HABIT_QUESTIONS.slice(3).map((q) => (
            <QuestionRow
              key={q.field}
              question={q.question}
              options={q.options}
              value={ctx.values[q.field] as string | undefined}
              onSelect={(value) => ctx.form.setValue(q.field, value, { shouldValidate: true })}
            />
          ))}
        </div>
      </div>
    </ScreenWrap>
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
