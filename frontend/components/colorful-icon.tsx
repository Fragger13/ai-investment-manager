import type { LucideIcon } from "lucide-react";

export type IconAccent = "cyan" | "emerald" | "amber" | "rose" | "violet" | "blue" | "orange";

const accentStyles: Record<IconAccent, string> = {
  cyan: "border-cyan-500/35 bg-cyan-500/[0.12] text-cyan-700 shadow-[0_6px_18px_rgba(8,145,178,0.14)] dark:border-cyan-300/35 dark:bg-cyan-400/[0.14] dark:text-cyan-200 dark:shadow-[0_6px_18px_rgba(34,211,238,0.12)]",
  emerald: "border-emerald-500/35 bg-emerald-500/[0.12] text-emerald-700 shadow-[0_6px_18px_rgba(5,150,105,0.14)] dark:border-emerald-300/35 dark:bg-emerald-400/[0.14] dark:text-emerald-200 dark:shadow-[0_6px_18px_rgba(52,211,153,0.12)]",
  amber: "border-amber-500/35 bg-amber-500/[0.12] text-amber-700 shadow-[0_6px_18px_rgba(245,158,11,0.14)] dark:border-amber-300/35 dark:bg-amber-400/[0.14] dark:text-amber-200 dark:shadow-[0_6px_18px_rgba(251,191,36,0.12)]",
  rose: "border-rose-500/35 bg-rose-500/[0.12] text-rose-700 shadow-[0_6px_18px_rgba(225,29,72,0.14)] dark:border-rose-300/35 dark:bg-rose-400/[0.14] dark:text-rose-200 dark:shadow-[0_6px_18px_rgba(251,113,133,0.12)]",
  violet: "border-violet-500/35 bg-violet-500/[0.12] text-violet-700 shadow-[0_6px_18px_rgba(124,58,237,0.14)] dark:border-violet-300/35 dark:bg-violet-400/[0.14] dark:text-violet-200 dark:shadow-[0_6px_18px_rgba(167,139,250,0.12)]",
  blue: "border-blue-500/35 bg-blue-500/[0.12] text-blue-700 shadow-[0_6px_18px_rgba(37,99,235,0.14)] dark:border-blue-300/35 dark:bg-blue-400/[0.14] dark:text-blue-200 dark:shadow-[0_6px_18px_rgba(96,165,250,0.12)]",
  orange: "border-orange-500/35 bg-orange-500/[0.12] text-orange-700 shadow-[0_6px_18px_rgba(234,88,12,0.14)] dark:border-orange-300/35 dark:bg-orange-400/[0.14] dark:text-orange-200 dark:shadow-[0_6px_18px_rgba(251,146,60,0.12)]",
};

export function ColorfulIcon({
  icon: Icon,
  label,
  accent = "cyan",
  size = "md",
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  accent?: IconAccent;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimensions = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const iconSize = size === "sm" ? "h-[18px] w-[18px]" : size === "lg" ? "h-[22px] w-[22px]" : "h-[21px] w-[21px]";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`flex shrink-0 items-center justify-center rounded-lg border backdrop-blur-sm transition-colors duration-200 ${dimensions} ${accentStyles[accent]} ${className}`}
    >
      <Icon className={iconSize} strokeWidth={2.15} aria-hidden="true" />
    </span>
  );
}
