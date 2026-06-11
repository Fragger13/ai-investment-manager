"use client";

import { Check } from "lucide-react";
import { ReactNode } from "react";

type OptionPillProps = {
  label: string;
  emoji?: string;
  selected: boolean;
  onSelect: () => void;
  ariaLabel?: string;
};

export function OptionPill({ label, emoji, selected, onSelect, ariaLabel }: OptionPillProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel || label}
      onClick={onSelect}
      className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[15px] font-medium shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C] focus-visible:ring-offset-2 ${
        selected
          ? "border-[#138A3C] bg-[#138A3C] text-white"
          : "border-[#E5E7EB] bg-white text-[#0F172A] hover:border-[#138A3C]/40 hover:bg-[#F8FAF9]"
      }`}
    >
      {emoji ? <span aria-hidden className="text-2xl leading-none">{emoji}</span> : null}
      <span>{label}</span>
    </button>
  );
}

type ChoiceCardProps = {
  title: string;
  helper?: string;
  emoji?: string;
  icon?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  ariaLabel?: string;
  compact?: boolean;
};

export function ChoiceCard({ title, helper, emoji, icon, selected, onSelect, ariaLabel, compact = false }: ChoiceCardProps) {
  if (compact) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        aria-label={ariaLabel || title}
        onClick={onSelect}
        className={`group relative flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C] focus-visible:ring-offset-2 ${
          selected
            ? "border-[#138A3C] bg-[#E9F4EC]"
            : "border-[#E5E7EB] bg-white hover:border-[#138A3C]/40 hover:shadow-sm"
        }`}
      >
        {emoji ? (
          <span className="mt-0.5 text-base leading-none" aria-hidden>
            {emoji}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight text-[#0F172A]">{title}</span>
          {helper ? <span className="mt-0.5 block text-[12px] leading-snug text-[#4B5563]">{helper}</span> : null}
        </span>
        {selected ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#138A3C] text-white">
            <Check className="h-2.5 w-2.5" />
          </span>
        ) : null}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel || title}
      onClick={onSelect}
      className={`group flex w-full items-center gap-4 rounded-2xl border px-5 py-5 text-left shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C] focus-visible:ring-offset-2 ${
        selected
          ? "border-[#138A3C] bg-[#E9F4EC] ring-2 ring-[#138A3C] ring-offset-1"
          : "border-[#E5E7EB] bg-white hover:-translate-y-0.5 hover:border-[#138A3C]/40 hover:shadow-lg"
      }`}
    >
      {emoji ? (
        <span className="text-3xl" aria-hidden>
          {emoji}
        </span>
      ) : icon ? (
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${selected ? "bg-[#138A3C] text-white" : "bg-[#E9F4EC] text-[#138A3C]"}`}>
          {icon}
        </span>
      ) : null}
      <span className="flex-1">
        <span className="block text-base font-semibold text-[#0F172A]">{title}</span>
        {helper ? <span className="mt-1 block text-sm leading-6 text-[#4B5563]">{helper}</span> : null}
      </span>
      {selected ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#138A3C] text-white">
          <Check className="h-4 w-4" />
        </span>
      ) : null}
    </button>
  );
}
