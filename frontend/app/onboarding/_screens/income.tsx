"use client";

import { ChoiceCard } from "../_components/choice-card";
import { CurrencyField } from "../_lib/field-helpers";
import { formatINR } from "@/lib/currency";
import { ScreenWrap } from "./about";
import { ScreenContext } from "../_flow/types";

const SALARY_DAY_OPTIONS = [
  { value: "Last working day", emoji: "📅", helper: "End of every month" },
  { value: "1st of the month", emoji: "🗓️", helper: "Start of every month" },
  { value: "Variable", emoji: "🔀", helper: "Not fixed / irregular" }
];

export function IncomeScreen({ form, values }: ScreenContext) {
  const inflow = Number(values.monthlySalary || 0) + Number(values.otherIncome || 0);
  const salaryDay = values.salaryDay || "";
  return (
    <ScreenWrap
      papa="Don't round up too much. Your bank account knows the truth."
      headline="Your monthly income"
      sub="In-hand take-home after tax, plus anything else regular. Skip extras if you don't have any."
      mood="thoughtful"
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <CurrencyField name="monthlySalary" label="In-hand salary" placeholder="e.g., 1,50,000" autoFocus />
          <CurrencyField name="otherIncome" label="Other income" placeholder="Rent, freelance, dividends…" optional />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Salary" value={formatINR(values.monthlySalary || 0)} />
          <Tile label="Other income" value={formatINR(values.otherIncome || 0)} />
          <Tile label="Total inflow" value={formatINR(inflow)} highlight />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CurrencyField
            name="investableThisMonth"
            label="How much can you invest this month?"
            placeholder="e.g., 30,000"
            helper="Just for this month — later months auto-use income minus expenses."
            optional
          />
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-[#0F172A]">When do you usually get your salary?<span className="ml-1 text-red-500" aria-hidden>*</span></p>
          <div className="grid gap-3 sm:grid-cols-3">
            {SALARY_DAY_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                title={option.value}
                helper={option.helper}
                emoji={option.emoji}
                selected={salaryDay === option.value}
                onSelect={() => form.setValue("salaryDay", option.value, { shouldValidate: true })}
              />
            ))}
          </div>
        </div>
      </div>
    </ScreenWrap>
  );
}

function Tile({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 shadow-md ${highlight ? "border-[#138A3C] bg-[#E9F4EC]" : "border-[#E5E7EB] bg-white"}`}>
      <p className="text-xs uppercase tracking-wide text-[#4B5563]">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? "text-[#138A3C]" : "text-[#0F172A]"}`}>{value}</p>
    </div>
  );
}
