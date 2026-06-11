import { cn } from "@/lib/utils";

export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "good" | "warn" | "danger" | "neutral" | "info" | "primary" }) {
  const tones = {
    good: "bg-positive-soft text-positive-foreground",
    warn: "bg-warning-soft text-warning-foreground",
    danger: "bg-negative-soft text-negative-foreground",
    info: "bg-info-soft text-info-foreground",
    primary: "bg-accent text-accent-foreground",
    neutral: "bg-surface-soft text-secondary-foreground"
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)} {...props} />;
}
