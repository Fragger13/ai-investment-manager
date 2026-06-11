"use client";

import type { LucideIcon } from "lucide-react";
import { ColorfulIcon, type IconAccent } from "@/components/colorful-icon";

export function RecommendationMetricCard({ label, value, icon, accent = "cyan" }: { label: string; value: string; icon?: LucideIcon; accent?: IconAccent }) {
  return (
    <div className="rounded-lg border border-border bg-surface-soft p-3 shadow-sm">
      <div className="flex items-center gap-2">
        {icon ? <ColorfulIcon icon={icon} accent={accent} label={label} size="sm" /> : null}
        <p className="text-[11px] font-medium uppercase tracking-[0.02em] text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 min-h-5 break-words text-sm font-semibold leading-5 text-foreground">{value}</p>
    </div>
  );
}
