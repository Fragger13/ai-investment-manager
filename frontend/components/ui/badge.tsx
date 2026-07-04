import { cn } from "@/lib/utils";

type Tone = "good" | "warn" | "danger" | "neutral" | "info" | "primary" | "coral" | "sun" | "grape";

export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const tones: Record<Tone, string> = {
    good: "bg-positive-soft text-positive-foreground",
    warn: "bg-warning-soft text-warning-foreground",
    danger: "bg-negative-soft text-negative-foreground",
    info: "bg-info-soft text-info-foreground",
    primary: "bg-accent text-accent-foreground",
    coral: "bg-coral-soft text-coral",
    sun: "bg-sun-soft text-sun-foreground",
    grape: "bg-grape-soft text-grape",
    neutral: "bg-surface-soft text-secondary-foreground"
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)} {...props} />;
}
