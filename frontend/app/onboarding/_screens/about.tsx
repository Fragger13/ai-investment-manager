"use client";

import { ChoiceCard } from "../_components/choice-card";
import { PapaBubble, PapaMood } from "../_components/papa-bubble";
import { CityField, TextField } from "../_lib/field-helpers";
import { ScreenContext } from "../_flow/types";

const FAMILY_OPTIONS = [
  { value: "Single", emoji: "🙂", helper: "Just you, for now" },
  { value: "Married", emoji: "💑", helper: "You and your partner" },
  { value: "Partnered", emoji: "🤝", helper: "Long-term partner, not formally married" }
];

export function AboutScreen({ form, values }: ScreenContext) {
  const current = values.maritalStatus || "";
  return (
    <ScreenWrap
      papa="I'm only asking because your money behaves differently from mine."
      headline="About you"
      sub="A few quick fields. Whatever you tell me here shapes everything Papa suggests next."
      mood="curious"
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="name"
            label="Your name"
            placeholder="e.g., Rohan Sharma"
            autoFocus
            sanitize={(v) => v.replace(/[^\p{L}\s.'-]/gu, "")}
          />
          <TextField
            name="dateOfBirth"
            type="date"
            label="Date of birth"
            helper={values.age ? `Age: ${values.age}` : "Your age helps me plan retirement and risk."}
          />
          <CityField name="city" label="City" placeholder="Start typing, e.g., Beng…" />
          <TextField name="occupation" label="What do you do?" placeholder="e.g., Product manager, founder, student" />
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-[#0F172A]">Family status<span className="ml-1 text-red-500" aria-hidden>*</span></p>
          <div className="grid gap-3 sm:grid-cols-3">
            {FAMILY_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                title={option.value}
                helper={option.helper}
                emoji={option.emoji}
                selected={current === option.value}
                onSelect={() => form.setValue("maritalStatus", option.value, { shouldValidate: true })}
              />
            ))}
          </div>
        </div>
      </div>
    </ScreenWrap>
  );
}

export function ScreenWrap({
  papa,
  headline,
  sub,
  mood,
  badge,
  children
}: {
  papa: string;
  headline: string;
  sub?: string;
  mood?: PapaMood;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[1.375rem] font-semibold leading-tight text-[#0F172A] sm:text-[1.75rem]">{headline}</h2>
          {badge}
        </div>
        {sub ? <p className="mt-1 text-[0.9375rem] leading-6 text-[#4B5563]">{sub}</p> : null}
      </div>
      <div className="mt-4 mb-[1cm]">
        <PapaBubble message={papa} mood={mood} size="md" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
