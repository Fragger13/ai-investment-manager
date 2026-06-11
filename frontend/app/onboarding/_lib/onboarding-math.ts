import { EmiLoan } from "@/types";

export function monthsUntil(date: string): number {
  if (!date) return 0;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return 0;
  const now = new Date();
  const months = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
  return Math.max(months, 1);
}

export function loanDurationMonths(loan?: Partial<EmiLoan>): number {
  if (!loan?.startDate || !loan?.endDate) return 0;
  const start = new Date(loan.startDate);
  const end = new Date(loan.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}

export function calculateMonthlyEmi(loan?: Partial<EmiLoan>): number {
  const principal = Number(loan?.principalAmount || 0);
  const interest = Number(loan?.totalInterestAmount || 0);
  const months = loanDurationMonths(loan);
  return principal > 0 && interest > 0 && months > 0 ? Math.round((principal + interest) / months) : 0;
}

export function estimateInterestRate(loan?: Partial<EmiLoan>): number {
  const principal = Number(loan?.principalAmount || 0);
  const interest = Number(loan?.totalInterestAmount || 0);
  if (!principal || !interest || !loan?.startDate || !loan?.endDate) return 0;
  const months = loanDurationMonths(loan);
  if (!months) return 0;
  const years = months / 12;
  return Number(((interest / principal / years) * 100).toFixed(2));
}

export function estimatedEmi(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  const months = Math.max(years * 12, 1);
  const monthlyRate = annualRate / 12 / 100;
  if (!monthlyRate) return Math.ceil(principal / months);
  return Math.ceil((principal * monthlyRate * (1 + monthlyRate) ** months) / ((1 + monthlyRate) ** months - 1));
}

export function hasModernLoanDetails(loan?: Partial<EmiLoan>): boolean {
  return Boolean(loan?.totalInterestAmount || loan?.startDate || loan?.endDate);
}
