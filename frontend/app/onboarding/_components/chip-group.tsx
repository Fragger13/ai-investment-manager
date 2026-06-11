"use client";

import { Check } from "lucide-react";
import { ReactNode } from "react";

type ChipOption = {
  value: string;
  label: string;
  emoji?: string;
  icon?: ReactNode;
};

type ChipGroupProps = {
  options: ChipOption[];
  selected: string[];
  onToggle: (value: string) => void;
  columns?: 2 | 3;
};

export function ChipGroup({ options, selected, onToggle, columns = 2 }: ChipGroupProps) {
  const gridCols = columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <div className={`grid grid-cols-1 gap-2.5 ${gridCols}`}>
      {options.map((option) => {
        const isOn = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isOn}
            onClick={() => onToggle(option.value)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              isOn
                ? "border-[#138A3C] bg-[#E9F4EC] font-semibold text-[#138A3C] shadow-md"
                : "border-[#E5E7EB] bg-white text-[#0F172A] hover:border-[#138A3C]/40 hover:bg-[#FAFAFA]"
            }`}
          >
            {option.emoji ? <span aria-hidden>{option.emoji}</span> : option.icon}
            <span className="flex-1">{option.label}</span>
            {isOn ? <Check className="h-4 w-4 text-[#138A3C]" /> : null}
          </button>
        );
      })}
    </div>
  );
}
