"use client";

import { OptionPill } from "../_components/choice-card";
import { fieldError } from "../_lib/field-helpers";
import { ScreenWrap } from "./about";
import { AnsweredBadge, scrollToNextUnanswered, useScrollToFirstError } from "./risk";
import { ScreenContext } from "../_flow/types";
import { OnboardingProfile } from "@/types";

type HabitField = keyof Pick<
  OnboardingProfile,
  "spendingDiscipline" | "emotionalSpendingTendency" | "tracksExpenses" | "investsMonthly" | "investingBlocker"
>;

type Option = { value: string; title: string; emoji: string };

// Multi-select answers are stored as a ", "-joined string so the profile schema
// and backend stay a plain string (no array migration). None of the option
// values contain a comma, so the join/split round-trips cleanly.
const MULTI_SEP = ", ";
const parseMulti = (value?: string): string[] => (value ? value.split(MULTI_SEP).filter(Boolean) : []);

const HABIT_QUESTIONS: { field: HabitField; question: string; options: Option[]; multi?: boolean; note?: string }[] = [
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
      { value: "Often", title: "Regularly", emoji: "📆" }
    ]
  },
  {
    field: "investingBlocker",
    question: "What usually stops you from investing more?",
    multi: true,
    note: "Pick all that apply",
    options: [
      { value: "Nothing right now", title: "Nothing right now", emoji: "🌈" },
      { value: "Irregular income", title: "Irregular income", emoji: "📉" },
      { value: "Fear of losses", title: "Fear of losses", emoji: "😨" },
      { value: "Unexpected expenses", title: "Surprise expenses", emoji: "🛠️" },
      { value: "I forget or delay", title: "I forget or delay", emoji: "🕒" },
      { value: "Too many choices", title: "Too many choices", emoji: "🤯" }
    ]
  }
];

// "Nothing right now" is mutually exclusive with the real blockers.
const NO_BLOCKER = "Nothing right now";

export function HabitsScreen(ctx: ScreenContext) {
  const { errors } = ctx.form.formState;
  const erroredFields = HABIT_QUESTIONS
    .map((q) => q.field)
    .filter((field) => Boolean(fieldError(errors as Record<string, unknown>, field)));
  useScrollToFirstError(erroredFields);
  const answered = HABIT_QUESTIONS.filter((q) => Boolean(ctx.values[q.field])).length;
  const selectAnswer = (field: HabitField, value: string) => {
    ctx.form.setValue(field, value, { shouldValidate: true });
    scrollToNextUnanswered(HABIT_QUESTIONS.map((q) => q.field), field, (f) => f === field ? value : String(ctx.values[f as HabitField] || ""));
  };
  // Multi-select: toggle the tapped value in the joined string. Don't auto-jump
  // to the next question — the user may pick several here.
  const toggleAnswer = (field: HabitField, value: string) => {
    const current = parseMulti(String(ctx.values[field] || ""));
    let next: string[];
    if (value === NO_BLOCKER) {
      next = current.includes(NO_BLOCKER) ? [] : [NO_BLOCKER];
    } else {
      const withoutNone = current.filter((v) => v !== NO_BLOCKER);
      next = withoutNone.includes(value) ? withoutNone.filter((v) => v !== value) : [...withoutNone, value];
    }
    ctx.form.setValue(field, next.join(MULTI_SEP), { shouldValidate: true });
  };
  return (
    <ScreenWrap
      papa="Let's find out if you're Warren Buffett or 'Add to Cart' Buffett."
      headline="Your money habits"
      sub="Pick the option closest to how you usually act."
      mood="laugh"
      badge={<AnsweredBadge answered={answered} total={HABIT_QUESTIONS.length} />}
    >
      <div className="grid min-h-0 flex-1 gap-x-10 gap-y-5 lg:grid-cols-2">
        <div className="flex flex-col gap-12">
          {HABIT_QUESTIONS.slice(0, 3).map((q) => (
            <QuestionRow
              key={q.field}
              field={q.field}
              question={q.question}
              options={q.options}
              value={ctx.values[q.field] as string | undefined}
              error={erroredFields.includes(q.field)}
              multi={q.multi}
              note={q.note}
              onSelect={(value) => (q.multi ? toggleAnswer(q.field, value) : selectAnswer(q.field, value))}
            />
          ))}
        </div>
        <div className="flex flex-col gap-12">
          {HABIT_QUESTIONS.slice(3).map((q) => (
            <QuestionRow
              key={q.field}
              field={q.field}
              question={q.question}
              options={q.options}
              value={ctx.values[q.field] as string | undefined}
              error={erroredFields.includes(q.field)}
              multi={q.multi}
              note={q.note}
              onSelect={(value) => (q.multi ? toggleAnswer(q.field, value) : selectAnswer(q.field, value))}
            />
          ))}
        </div>
      </div>
    </ScreenWrap>
  );
}

function QuestionRow({
  field,
  question,
  options,
  value,
  error = false,
  multi = false,
  note,
  onSelect
}: {
  field: string;
  question: string;
  options: Option[];
  value?: string;
  error?: boolean;
  multi?: boolean;
  note?: string;
  onSelect: (value: string) => void;
}) {
  const selectedValues = multi ? parseMulti(value) : [];
  return (
    <div id={`question-${field}`} className={`space-y-2.5 rounded-xl transition ${error ? "-m-2 bg-red-50/60 p-2 ring-1 ring-red-300" : ""}`}>
      <p className={`text-base font-medium ${error ? "text-red-600" : "text-[#0F172A]"}`}>
        {question}<span className="ml-1 text-red-500" aria-hidden>*</span>
        {note ? <span className="ml-2 text-[0.8125rem] font-normal text-[#6B7280]">{note}</span> : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <OptionPill
            key={option.value}
            label={option.title}
            emoji={option.emoji}
            selected={multi ? selectedValues.includes(option.value) : value === option.value}
            onSelect={() => onSelect(option.value)}
          />
        ))}
      </div>
      {error ? <p className="text-[0.8125rem] font-medium text-red-600">{multi ? "Pick at least one to continue" : "Pick one to continue"}</p> : null}
    </div>
  );
}
