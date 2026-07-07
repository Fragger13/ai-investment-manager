"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { ChoiceCard } from "../_components/choice-card";
import { CurrencyField } from "../_lib/field-helpers";
import { formatINR } from "@/lib/currency";
import { monthlyCommitments } from "@/lib/profile";
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
  const [autoNote, setAutoNote] = useState<string | null>(null);

  // Fill "invest this month" with the same figure Papa uses for every later
  // month: income minus rent, everyday spends and EMIs (monthlyCommitments).
  function autoCalculateInvestable() {
    const income = Number(values.monthlyCashInflow || 0) || Number(values.monthlySalary || 0) + Number(values.otherIncome || 0);
    const commitments = monthlyCommitments(values);
    const surplus = Math.max(income - commitments, 0);
    form.setValue("investableThisMonth", surplus, { shouldValidate: true });
    setAutoNote(
      commitments > 0
        ? `Income ${formatINR(income)} minus your rent, spends and EMIs ${formatINR(commitments)} = ${formatINR(surplus)}.`
        : `Based on your income of ${formatINR(income)}. Add your spending and loans in the next steps and Papa will sharpen this.`,
    );
  }
  return (
    <ScreenWrap
      papa="Don't round up too much. Your bank account knows the truth."
      headline="Your monthly income"
      sub="In-hand take-home after tax, plus anything else regular. Skip extras if you don't have any."
      mood="thoughtful"
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <CurrencyField name="monthlySalary" label="In-hand salary" placeholder="e.g., 1,50,000" autoFocus hint="The pay that actually reaches your bank each month, after tax and PF deductions. Not your CTC or gross figure." />
          <CurrencyField name="otherIncome" label="Other income" placeholder="Rent, freelance, dividends…" optional hint="Any regular extra money: rent you receive, freelance or side income, dividends, and so on. Leave it blank if you don't have any." />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Salary" value={formatINR(values.monthlySalary || 0)} />
          <Tile label="Other income" value={formatINR(values.otherIncome || 0)} />
          <Tile label="Total inflow" value={formatINR(inflow)} highlight />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <CurrencyField
              name="investableThisMonth"
              label="How much can you invest this month?"
              placeholder="e.g., 30,000"
              helper="Just for this month. Later months auto-use income minus expenses."
              optional
              hint="Spare money you could put into investments right now, on top of your normal spending. A rough estimate is fine. From next month, Papa works it out as income minus expenses."
              action={
                <button
                  type="button"
                  onClick={autoCalculateInvestable}
                  className="inline-flex items-center gap-1 rounded-full border border-[#138A3C]/40 bg-[#E9F4EC] px-2 py-0.5 text-[0.6875rem] font-semibold text-[#138A3C] transition hover:border-[#138A3C] hover:bg-[#dcefe1]"
                >
                  <Calculator className="h-3 w-3" /> Auto-calculate
                </button>
              }
            />
            {autoNote ? <p className="text-[0.8125rem] leading-5 text-[#138A3C]">{autoNote}</p> : null}
          </div>
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
