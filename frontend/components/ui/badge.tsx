import { cn } from "@/lib/utils";

export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "good" | "warn" | "danger" | "neutral" }) {
  const tones = {
    good: "border-emerald-300/20 bg-emerald-400/[0.12] text-emerald-200",
    warn: "border-amber-300/20 bg-amber-400/[0.12] text-amber-200",
    danger: "border-red-300/20 bg-red-400/[0.12] text-red-200",
    neutral: "border-white/[0.12] bg-white/[0.08] text-slate-200"
  };
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium", tones[tone], className)} {...props} />;
}
