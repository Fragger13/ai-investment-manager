import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function inr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

// Compact Indian currency for at-a-glance cards:
//   1,25,846 -> "₹1.25 L"   74,253 -> "₹74 k"   9,07,809 -> "₹9.07 L"   1.5 Cr
// Floored to the displayed unit so the short form never reads higher than the
// real figure. Amounts under ₹1,000 are shown in full (₹500, ₹0).
export function inrShort(value: number) {
  const n = Math.round(value || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${sign}₹${trimZeros(Math.floor(abs / 1_00_000) / 100)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${trimZeros(Math.floor(abs / 1_000) / 100)} L`;
  if (abs >= 1_000) return `${sign}₹${Math.floor(abs / 1_000)} k`;
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
}

function trimZeros(v: number) {
  return v.toFixed(2).replace(/\.?0+$/, "");
}

export function pct(value: number) {
  return `${Math.round(value)}%`;
}
