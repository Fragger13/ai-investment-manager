"use client";

import { ColorfulIcon } from "@/components/colorful-icon";
import { Badge } from "@/components/ui/badge";
import { explanationIconSpec } from "@/lib/icon-maps";

type ExplanationCardProps = {
  title: string;
  summary: string;
  tone: string;
};

export function ExplanationCard({ title, summary, tone }: ExplanationCardProps) {
  const icon = explanationIconSpec(title);

  return (
    <div className="flex min-h-32 flex-col rounded-lg border border-border bg-surface-soft p-3.5 shadow-sm">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ColorfulIcon icon={icon.icon} accent={icon.accent} label={icon.label} size="sm" />
          <p className="text-sm font-medium leading-5 text-foreground">{title}</p>
        </div>
        <Badge className="shrink-0" tone={toneForText(tone)}>{tone}</Badge>
      </div>
      <p className="whitespace-normal break-words text-sm leading-6 text-foreground/80">{safeExplanationText(summary)}</p>
    </div>
  );
}

function toneForText(tone: string): "good" | "warn" | "danger" | "neutral" {
  const value = (tone || "").toLowerCase();
  if (value.includes("high") || value.includes("danger") || value.includes("weak")) return "danger";
  if (value.includes("medium") || value.includes("warn") || value.includes("watch") || value.includes("mixed") || value.includes("limited")) return "warn";
  if (value.includes("good") || value.includes("low") || value.includes("support")) return "good";
  return "neutral";
}

function safeExplanationText(value: string) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Explanation is being generated from the latest recommendation context.";
  if (normalized.length <= 220) return ensureSentence(normalized);
  const boundary = Math.max(normalized.lastIndexOf(". ", 210), normalized.lastIndexOf("; ", 210));
  if (boundary > 90) return ensureSentence(normalized.slice(0, boundary + 1));
  return ensureSentence(normalized.slice(0, 210));
}

function ensureSentence(value: string) {
  const text = value.trim().replace(/[,:;]$/, "");
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
