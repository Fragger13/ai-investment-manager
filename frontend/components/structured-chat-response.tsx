"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Car,
  CheckCircle2,
  CreditCard,
  Home,
  PiggyBank,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon
} from "lucide-react";
import type { ChatCard } from "@/lib/api";
import { inr } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  wallet: Wallet,
  calendar: CalendarDays,
  check: CheckCircle2,
  target: Target,
  home: Home,
  "trending-up": TrendingUp,
  "piggy-bank": PiggyBank,
  "credit-card": CreditCard,
  shield: ShieldCheck,
  "arrow-right": ArrowRight,
  car: Car,
  alert: AlertTriangle,
};

function resolveIcon(name?: string): LucideIcon {
  if (!name) return CheckCircle2;
  return ICON_MAP[name] || CheckCircle2;
}

export function ChatCardsRenderer({
  cards,
  onOption
}: {
  cards: ChatCard[];
  onOption?: (label: string) => void;
}) {
  if (!cards?.length) return null;
  return (
    <div className="mt-3 space-y-3">
      {cards.map((card, index) => {
        if (card.type === "metrics") return <MetricsCard key={index} card={card} />;
        if (card.type === "recommendation") return <RecommendationCard key={index} card={card} />;
        if (card.type === "options") return <OptionsRow key={index} card={card} onOption={onOption} />;
        return null;
      })}
    </div>
  );
}

function MetricsCard({ card }: { card: ChatCard }) {
  return (
    <div>
      {card.intro ? (
        <p className="mb-2 text-sm leading-6 text-foreground/85">{card.intro}</p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {(card.metrics || []).map((metric, index) => {
          const Icon = resolveIcon(metric.icon);
          const isLast = index === (card.metrics?.length || 0) - 1;
          return (
            <div
              key={`${metric.label}-${index}`}
              className={`flex items-center gap-3 px-4 py-3 ${!isLast ? "border-b border-border" : ""}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm text-muted-foreground">{metric.label}</span>
              <span className="text-base font-semibold text-foreground">{inr(metric.amount)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommendationCard({ card }: { card: ChatCard }) {
  const Icon = resolveIcon(card.icon);
  const toneClass =
    card.tone === "warning"
      ? "border-warning/30 bg-warning-soft/50"
      : card.tone === "neutral"
      ? "border-border bg-surface-soft"
      : "border-positive-soft bg-positive-soft/50";
  const titleClass = card.tone === "warning" ? "text-warning-foreground" : "text-positive-foreground";
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm">
          <Icon className="h-5 w-5 text-positive-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          {card.title ? <p className={`text-sm font-semibold ${titleClass}`}>{card.title}</p> : null}
          {card.body ? <p className="mt-1 text-sm leading-6 text-foreground/85">{card.body}</p> : null}
        </div>
      </div>
    </div>
  );
}

function OptionsRow({
  card,
  onOption
}: {
  card: ChatCard;
  onOption?: (label: string) => void;
}) {
  if (!card.options?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {card.options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onOption?.(option.label)}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
            option.primary
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-border bg-surface text-foreground hover:bg-surface-hover"
          }`}
        >
          {option.primary ? <CheckCircle2 className="h-4 w-4" /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}
