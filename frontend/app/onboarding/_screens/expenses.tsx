"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChoiceCard } from "../_components/choice-card";
import { PapaPeek } from "../_components/papa-peek";
import { CurrencyField } from "../_lib/field-helpers";
import { formatINR, formatIndianCurrencyInput, parseIndianCurrencyInput } from "@/lib/currency";
import { ScreenWrap } from "./about";
import { ScreenContext } from "../_flow/types";
import { EmiLoan } from "@/types";
import { calculateMonthlyEmi } from "../_lib/onboarding-math";

const LOAN_TYPES = ["Home", "Vehicle", "Education", "Electronics", "Personal Loan", "Credit Card EMI", "Business Loan", "Other"];

export function emptyEmiLoan(): EmiLoan {
  return {
    productType: "",
    name: "",
    principalAmount: 0,
    totalInterestAmount: 0,
    totalEmiAmount: 0,
    startDate: "",
    endDate: "",
    monthlyEmiAmount: 0,
    estimatedInterestRate: 0
  };
}

export function SpendingScreen(_ctx: ScreenContext) {
  return (
    <ScreenWrap
      papa="Money talks. Yours seems to be saying 'goodbye' a lot."
      headline="Your spending"
      sub="Rent and everything else that goes out each month."
      mood="caring"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CurrencyField
          name="rent"
          label="Monthly house rent"
          placeholder="e.g., 30,000 (or 0 if you own)"
          autoFocus
          size="lg"
        />
        <CurrencyField
          name="monthlyExpenses"
          label="Other monthly expenses"
          placeholder="Total monthly spend"
          helper="Groceries, shopping, eating out, subscriptions (Netflix, Spotify), bills — bundle it all in. Don't include rent or EMIs."
          size="lg"
        />
      </div>
    </ScreenWrap>
  );
}

export function LoansScreen({ form, values }: ScreenContext) {
  const loans = (values.emiLoans || []) as EmiLoan[];
  const hasLoans = loans.length > 0;
  const [peekOpen, setPeekOpen] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setPeekOpen(true), 500);
    return () => window.clearTimeout(t);
  }, []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<EmiLoan>(emptyEmiLoan());
  // Default to "Yes I have loans" selected on entry. Only flip to "No"
  // when the user explicitly clicks it during this session.
  const yesSelected = values.hasEmiLoans !== false;
  const noSelected = values.hasEmiLoans === false && !hasLoans;

  const openAdd = () => {
    form.setValue("hasEmiLoans", true, { shouldValidate: false });
    setDraft(emptyEmiLoan());
    setEditingIndex(null);
    setDialogOpen(true);
  };
  const openEdit = (index: number) => {
    setDraft({ ...emptyEmiLoan(), ...(loans[index] || {}) } as EmiLoan);
    setEditingIndex(index);
    setDialogOpen(true);
  };
  const commit = (next: EmiLoan, addAnother: boolean) => {
    const current = (form.getValues("emiLoans") || []) as EmiLoan[];
    const updated = editingIndex !== null
      ? current.map((l, i) => (i === editingIndex ? next : l))
      : [...current, next];
    form.setValue("hasEmiLoans", true, { shouldValidate: false });
    form.setValue("emiLoans", updated, { shouldValidate: true });
    if (addAnother) {
      setDraft(emptyEmiLoan());
      setEditingIndex(null);
    } else {
      setDialogOpen(false);
    }
  };
  const removeLoan = (index: number) => {
    const current = (form.getValues("emiLoans") || []) as EmiLoan[];
    form.setValue(
      "emiLoans",
      current.filter((_, i) => i !== index),
      { shouldValidate: true }
    );
  };

  return (
    <ScreenWrap
      papa={noSelected
        ? "Look at you. Financial freedom's favourite child."
        : "Let's count how many people are waiting for your salary before you do."}
      headline="Loans and EMIs"
      sub="Home, car, education, credit card, personal — anything where you pay monthly."
      mood={noSelected ? "blessed" : "concerned"}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            title="Yes, I have loans / EMIs"
            helper={hasLoans ? `${loans.length} loan${loans.length > 1 ? "s" : ""} added — tap to add another` : "Tap to add one in a quick popup"}
            emoji="💳"
            selected={yesSelected}
            onSelect={() => {
              form.setValue("hasEmiLoans", true, { shouldValidate: false });
              openAdd();
            }}
          />
          <ChoiceCard
            title="No loans right now"
            helper="Skip this section"
            emoji="🎉"
            selected={noSelected}
            onSelect={() => {
              form.setValue("hasEmiLoans", false, { shouldValidate: false });
              form.setValue("emiLoans", [], { shouldValidate: true });
              setPeekOpen(false);
            }}
          />
        </div>

        {hasLoans ? (
          <div className="space-y-2">
            {loans.map((loan, index) => {
              const monthly = Number(loan?.monthlyEmiAmount || 0) || calculateMonthlyEmi(loan);
              return (
                <div key={index} className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3 shadow-md">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0F172A]">{loan?.name || loan?.productType || `Loan ${index + 1}`}</p>
                    <p className="mt-0.5 text-[13px] text-[#4B5563]">{loan?.productType || "—"} · {monthly ? `${formatINR(monthly)} / month` : "Add start + end dates"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={() => openEdit(index)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => removeLoan(index)} title="Remove"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" className="w-full rounded-full" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add another loan
            </Button>
          </div>
        ) : null}
      </div>

      <LoanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        setDraft={setDraft}
        isEdit={editingIndex !== null}
        onCommit={commit}
      />

      <PapaPeek open={peekOpen} onClose={() => setPeekOpen(false)} variant="edge">
        Not sure where to look, beta? Check <a href="https://www.cibil.com/" target="_blank" rel="noreferrer noopener" className="underline">CIBIL</a> for every loan on your PAN, and your credit card statements for any card EMIs.
      </PapaPeek>
    </ScreenWrap>
  );
}

function LoanDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  isEdit,
  onCommit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: EmiLoan;
  setDraft: (loan: EmiLoan) => void;
  isEdit: boolean;
  onCommit: (loan: EmiLoan, addAnother: boolean) => void;
}) {
  const update = (patch: Partial<EmiLoan>) => setDraft({ ...draft, ...patch });
  const datesValid = Boolean(draft.startDate && draft.endDate && new Date(draft.endDate) >= new Date(draft.startDate));
  const monthlyEmi = Number(draft.monthlyEmiAmount || 0);
  const valid = Boolean(
    draft.productType && draft.name.trim() && monthlyEmi > 0 && datesValid
  );
  const months = monthsBetween(draft.startDate, draft.endDate);
  const calculatedTotalAmount = monthlyEmi * months;
  const totalAmount = Number(draft.totalEmiAmount || 0) || calculatedTotalAmount;

  const updateMonthlyEmi = (amount: number) => {
    const monthsForCurrentDates = monthsBetween(draft.startDate, draft.endDate);
    const total = amount > 0 && monthsForCurrentDates > 0 ? amount * monthsForCurrentDates : Number(draft.totalEmiAmount || 0);
    setDraft({ ...draft, monthlyEmiAmount: amount, totalEmiAmount: total });
  };

  const updateStartDate = (date: string) => {
    const nextMonths = monthsBetween(date, draft.endDate);
    setDraft({
      ...draft,
      startDate: date,
      totalEmiAmount: monthlyEmi > 0 && nextMonths > 0 ? monthlyEmi * nextMonths : draft.totalEmiAmount,
    });
  };

  const updateEndDate = (date: string) => {
    const currentTotal = Number(draft.totalEmiAmount || 0);
    if (monthlyEmi > 0 && currentTotal > 0) {
      const requiredMonths = Math.max(Math.ceil(currentTotal / monthlyEmi), 1);
      setDraft({
        ...draft,
        endDate: date,
        startDate: startDateForInclusiveMonths(date, requiredMonths) || draft.startDate,
      });
      return;
    }

    const nextMonths = monthsBetween(draft.startDate, date);
    setDraft({
      ...draft,
      endDate: date,
      totalEmiAmount: monthlyEmi > 0 && nextMonths > 0 ? monthlyEmi * nextMonths : draft.totalEmiAmount,
    });
  };

  const updateTotalAmount = (amount: number) => {
    if (monthlyEmi > 0 && draft.endDate && amount > 0) {
      const requiredMonths = Math.max(Math.ceil(amount / monthlyEmi), 1);
      setDraft({
        ...draft,
        totalEmiAmount: amount,
        startDate: startDateForInclusiveMonths(draft.endDate, requiredMonths) || draft.startDate,
      });
      return;
    }
    setDraft({ ...draft, totalEmiAmount: amount });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogTitle className="text-lg font-semibold text-[#0F172A]">{isEdit ? "Edit loan" : "Add a loan"}</DialogTitle>
        <p className="mt-1 text-sm text-[#4B5563]">Use Save & add another to enter several without closing.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Loan / EMI type</Label>
            <Select value={draft.productType || ""} onValueChange={(value) => update({ productType: value })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {LOAN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input placeholder="e.g., Car loan, iPhone EMI" value={draft.name || ""} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Monthly EMI</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
              <Input className="pl-7" inputMode="numeric" placeholder="What you pay every month" value={monthlyEmi ? formatIndianCurrencyInput(monthlyEmi) : ""} onChange={(e) => updateMonthlyEmi(parseIndianCurrencyInput(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input type="date" value={draft.startDate || ""} onChange={(e) => updateStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <Input type="date" value={draft.endDate || ""} onChange={(e) => updateEndDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3">
          <Label className="text-[13px] uppercase tracking-wide text-[#4B5563]">Total loan / EMI amount</Label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
            <Input
              className="pl-7 font-semibold"
              inputMode="numeric"
              placeholder="Add monthly EMI, start and end dates"
              value={totalAmount ? formatIndianCurrencyInput(totalAmount) : ""}
              onChange={(e) => updateTotalAmount(parseIndianCurrencyInput(e.target.value))}
            />
          </div>
          {monthlyEmi > 0 && months > 0 ? (
            <p className="mt-0.5 text-[12px] text-[#4B5563]">{months} months × {formatINR(monthlyEmi)}</p>
          ) : null}
          {monthlyEmi > 0 && draft.endDate ? (
            <p className="mt-1 text-[12px] text-[#4B5563]">Changing this amount adjusts the start date based on your EMI and end date.</p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!isEdit ? (
            <Button type="button" variant="outline" disabled={!valid} onClick={() => onCommit({ ...draft, monthlyEmiAmount: monthlyEmi, totalEmiAmount: totalAmount || calculatedTotalAmount, principalAmount: 0, totalInterestAmount: 0, estimatedInterestRate: 0 }, true)}>
              Save & add another
            </Button>
          ) : null}
          <Button type="button" disabled={!valid} className="bg-[#138A3C] text-white hover:bg-[#107132]" onClick={() => onCommit({ ...draft, monthlyEmiAmount: monthlyEmi, totalEmiAmount: totalAmount || calculatedTotalAmount, principalAmount: 0, totalInterestAmount: 0, estimatedInterestRate: 0 }, false)}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function monthsBetween(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}

function startDateForInclusiveMonths(endDate: string, months: number): string {
  if (!endDate || months <= 0) return "";
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return "";

  const targetMonthIndex = end.getFullYear() * 12 + end.getMonth() - months + 1;
  const year = Math.floor(targetMonthIndex / 12);
  const month = targetMonthIndex % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(end.getDate(), lastDay);
  const start = new Date(year, month, day);
  return start.toISOString().slice(0, 10);
}
