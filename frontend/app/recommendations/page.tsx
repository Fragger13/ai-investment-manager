"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Sparkles, TrendingUp, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { InvestmentLogo } from "@/components/investment-logo";
import { TakeActionDialog } from "@/components/take-action-dialog";
import { api } from "@/lib/api";
import { cn, inr } from "@/lib/utils";
import { availableToInvest, emptyDashboard } from "@/lib/profile";
import { useEnsureProfile } from "@/lib/use-ensure-profile";
import {
  ActionItem,
  TAB_LABELS,
  TabName,
  amountLabel,
  buildPlan,
  hasMoneyAmount,
  idealNote,
  mergeIntoActionItems,
  planConfidence,
  purposeTag,
  tabs,
} from "@/lib/plan";
import { usePlanActionsStore } from "@/store/plan-actions-store";
import { AdvancedRecommendationResponse, DashboardData } from "@/types";

const emptyAdvanced: AdvancedRecommendationResponse = {
  recommendations: [],
  signals: [],
  assets: [],
  dataMode: "fallback",
  lastResearchedAt: "",
  sourceCount: 0,
  disclaimer: "These suggestions are here to help you decide what to review next. They are not promises of returns."
};

export default function RecommendationsPage() {
  // Self-heal the profile (like the Dashboard) so the budget the plan is sized
  // to ("available this month") matches the other tabs even on a direct load.
  const profile = useEnsureProfile();
  const [data, setData] = useState<AdvancedRecommendationResponse>(emptyAdvanced);
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>("Must Do");

  async function load(refreshResearch = false) {
    setLoading(true);
    try {
      const [recs, dash] = await Promise.all([
        profile ? api.generateAdvancedRecommendations(profile, refreshResearch) : Promise.resolve(emptyAdvanced),
        profile ? api.dashboard(profile) : Promise.resolve(emptyDashboard),
      ]);
      setData(recs);
      setDashboard(dash);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const actionsTaken = usePlanActionsStore((state) => state.actionsTaken);
  const takenKeys = useMemo(() => new Set(actionsTaken.map((entry) => entry.key)), [actionsTaken]);
  const items = useMemo(() => mergeIntoActionItems(data.recommendations, dashboard), [data.recommendations, dashboard]);
  // The budget every suggested amount is sized to. Recomputes (and the plan
  // re-sizes itself) whenever the profile's "available this month" changes.
  const available = useMemo(() => availableToInvest(profile, dashboard.summary.monthlyIncome), [profile, dashboard.summary.monthlyIncome]);
  const grouped = useMemo(() => buildPlan(items, takenKeys, available), [items, takenKeys, available]);
  const visible = grouped[activeTab];
  const confidence = planConfidence(items);
  const confidenceTone: "good" | "warn" | "danger" = confidence >= 75 ? "good" : confidence >= 55 ? "warn" : "danger";

  // Habit reinforcement: how many of the surfaced actions you've already done.
  const doneCount = useMemo(() => items.filter((item) => takenKeys.has(item.key)).length, [items, takenKeys]);
  const totalCount = items.length;

  return (
    <AppShell sidebarExtra={<PlanProgressWidget confidence={confidence} done={doneCount} total={totalCount} />}>
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">Your money plan ✨</h1>
          <p className="mt-2 text-base text-muted-foreground">Simple steps, picked just for you. Do them one at a time — no finance degree needed.</p>
        </div>
        <PlanConfidenceCard confidence={confidence} tone={confidenceTone} />
      </div>

      <SavedByYouSection />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-full border border-border bg-surface p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {TAB_LABELS[tab]} ({grouped[tab].length})
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => load(true)} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> {loading ? "Refreshing..." : "Refresh plan"}
        </Button>
      </div>

      {activeTab === "Must Do" ? (
        <Section
          heading="Do this first 💪"
          subtitle={available > 0
            ? `Sized to the ${inr(available)} you have to invest this month. Knock one out and the next pops up.`
            : "The 3 things worth doing now. Knock one out and the next one pops up automatically."}
        >
          {totalCount > 0 ? <DoFirstProgress done={doneCount} total={totalCount} /> : null}
          <div className="space-y-3">
            {visible.map((item) => <MustDoRow key={item.key} item={item} />)}
            {!visible.length ? (
              <EmptyRow text={doneCount > 0 ? "You're all caught up here! 🎉 Peek at the Next up tab for what's next." : "Refresh after completing your profile to see your first steps."} />
            ) : null}
          </div>
        </Section>
      ) : null}

      {activeTab === "Consider" ? (
        <Section heading="Next up" subtitle="Smart moves to level up your plan when you're ready.">
          <div className="space-y-2">
            {visible.map((item) => <ConsiderRow key={item.key} item={item} />)}
            {!visible.length ? <EmptyRow text="Nothing in this tab yet. Refresh after updating your profile." /> : null}
          </div>
        </Section>
      ) : null}

      {activeTab === "Explore" ? (
        <Section heading="Worth a look" subtitle="Other ideas to explore when you've got a minute.">
          <Card>
            <CardContent className="p-2">
              {visible.length ? visible.map((item, index) => (
                <ExploreRow key={item.key} item={item} divider={index !== visible.length - 1} />
              )) : <p className="p-4 text-sm text-muted-foreground">No exploration ideas right now.</p>}
            </CardContent>
          </Card>
        </Section>
      ) : null}
    </AppShell>
  );
}

function SavedByYouSection() {
  const items = usePlanActionsStore((state) => state.planItems);
  const remove = usePlanActionsStore((state) => state.removeFromPlan);
  const actionsTaken = usePlanActionsStore((state) => state.actionsTaken);
  if (!items.length) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="ap-section">Saved by you</h2>
          <p className="mt-0.5 text-[15px] leading-relaxed text-muted-foreground">Investments you added from Discover.</p>
        </div>
        <Badge tone="primary">{items.length}</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => {
          const taken = actionsTaken.find((entry) => entry.key === item.key);
          return (
            <Card key={item.key}>
              <CardContent className="grid items-center gap-3 p-3 md:grid-cols-[minmax(0,1fr)_140px_140px_44px] md:p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <InvestmentLogo name={item.instrumentName} category={item.category} ticker={item.ticker} size="md" />
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-foreground">{item.instrumentName}</p>
                    <p className="text-[13px] text-muted-foreground">{item.category}{item.ticker ? ` · ${item.ticker}` : ""}</p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {item.suggestedMonthlyAmount ? <span><span className="font-semibold text-foreground">{inr(item.suggestedMonthlyAmount)}</span> / mo</span> : "Amount TBD"}
                </div>
                <TakeActionDialog
                  payload={{
                    key: item.key,
                    instrumentName: item.instrumentName,
                    category: item.category,
                    ticker: item.ticker,
                    suggestedMonthlyAmount: item.suggestedMonthlyAmount,
                    actionLabel: "Take action",
                    kind: "fund",
                  }}
                  trigger={
                    <Button size="sm" variant={taken ? "outline" : "default"}>
                      {taken ? (<><CheckCircle2 className="h-3.5 w-3.5" /> Done</>) : "Take Action"}
                    </Button>
                  }
                />
                <button onClick={() => remove(item.key)} className="rounded-full p-2 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground" aria-label="Remove from plan">
                  <X className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DoFirstProgress({ done, total }: { done: number; total: number }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  const message =
    done === 0
      ? "Start with just one. That's how the habit builds."
      : done >= total
        ? "Every step done — you're on a roll! 🔥"
        : `${done} done, ${total - done} to go. Keep the streak alive!`;
  return (
    <div className="mb-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">This month&apos;s progress</p>
        <span className="text-sm font-bold text-primary">{done}/{total}</span>
      </div>
      <Progress value={percent} className="mt-2 h-2" />
      <p className="mt-2 text-[13px] text-muted-foreground">{message}</p>
    </div>
  );
}

function FactorChips({ item }: { item: ActionItem }) {
  const fi = item.factorInsights;
  if (!item.isFundPick || !fi) return null;
  const chips: string[] = [];
  if (fi.sortino != null) chips.push(`Sortino ${fi.sortino}`);
  if (fi.maxDrawdown3y != null) chips.push(`Worst 3y drop ${fi.maxDrawdown3y}%`);
  if (fi.downCapture != null) chips.push(`Down-capture ${fi.downCapture}`);
  if (fi.alpha != null) chips.push(`Alpha ${fi.alpha}%`);
  if (!chips.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {chips.slice(0, 4).map((chip) => (
        <span key={chip} className="rounded-full bg-surface-soft px-2 py-0.5 text-xs text-muted-foreground">{chip}</span>
      ))}
    </div>
  );
}

function CommunityChip({ item }: { item: ActionItem }) {
  const c = item.community;
  if (!c || !c.mentionCount) return null;
  const emoji = c.sentiment === "positive" ? "👍" : c.sentiment === "negative" ? "👎" : c.sentiment === "mixed" ? "↔️" : "💬";
  const label =
    c.sentiment === "positive" ? "Mostly positive" : c.sentiment === "negative" ? "Mostly negative" : c.sentiment === "mixed" ? "Mixed views" : "Neutral";
  const subs = (c.subreddits || []).slice(0, 2).map((s) => `r/${s}`).join(", ");
  return (
    <div className="mt-2">
      <span
        title={c.disclaimer || "Community chatter is noisy and can be biased — context, not advice."}
        className="inline-flex items-center gap-1 rounded-full bg-surface-soft px-2 py-0.5 text-xs text-muted-foreground"
      >
        {emoji} Reddit: {label} · {c.mentionCount} mention{c.mentionCount === 1 ? "" : "s"}
        {subs ? ` (${subs})` : ""}
      </span>
    </div>
  );
}

/** Beginner-friendly meta chips: what it's for, fit, and expected return. */
function MetaChips({ item }: { item: ActionItem }) {
  const fit = item.confidence >= 75 ? "Strong fit" : item.confidence >= 55 ? "Good fit" : "Optional";
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
        🎯 {purposeTag(item)}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-positive-soft px-2.5 py-1 text-xs font-semibold text-positive-foreground">
        ✅ {fit}
      </span>
      {item.expectedReturn ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-soft px-2.5 py-1 text-xs font-medium text-muted-foreground">
          📈 ~{item.expectedReturn}
        </span>
      ) : null}
    </div>
  );
}

/** The "how much" block — the number a beginner cares about most. */
function AmountBlock({ item }: { item: ActionItem }) {
  if (hasMoneyAmount(item)) {
    const note = idealNote(item);
    return (
      <div className="md:text-right">
        <p className="text-2xl font-extrabold tracking-tight text-foreground">{inr(item.suggestedMonthlyAmount)}</p>
        <p className="text-[13px] font-medium text-muted-foreground">start / month</p>
        {note ? <p className="mt-0.5 text-xs font-medium text-warning-foreground">{note}</p> : null}
      </div>
    );
  }
  return (
    <div className="md:text-right">
      <p className="text-base font-bold text-foreground">{amountLabel(item)}</p>
      <p className="text-[13px] text-muted-foreground">No money needed</p>
    </div>
  );
}

function Section({ heading, subtitle, children }: { heading: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="ap-section">{heading}</h2>
      <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function PlanConfidenceCard({ confidence, tone }: { confidence: number; tone: "good" | "warn" | "danger" }) {
  const label = confidence >= 75 ? "Good" : confidence >= 55 ? "Review slowly" : "Needs review";
  return (
    <Card className="w-full lg:w-72">
      <CardContent className="flex items-center gap-3 p-4">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", tone === "good" ? "bg-positive-soft" : tone === "warn" ? "bg-warning-soft" : "bg-negative-soft")}>
          <CheckCircle2 className={cn("h-5 w-5", tone === "good" ? "text-positive-foreground" : tone === "warn" ? "text-warning-foreground" : "text-negative-foreground")} />
        </span>
        <div className="flex-1">
          <p className="ap-label">Plan Confidence</p>
          <p className="text-2xl font-extrabold text-foreground tnum">{confidence}%</p>
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanProgressWidget({ confidence, done, total }: { confidence: number; done: number; total: number }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-positive-soft bg-positive-soft/60 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-positive-soft">
          <TrendingUp className="h-4 w-4 text-positive-foreground" />
        </span>
        <p className="text-sm font-semibold text-foreground">Keep going!</p>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        {done > 0 ? `${done} action${done === 1 ? "" : "s"} done. Small steps add up fast.` : "You're making great progress towards your goals."}
      </p>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{done}/{total} actions done</span>
          <span>{confidence}% confidence</span>
        </div>
        <Progress value={percent} className="mt-1.5 h-1.5" />
      </div>
    </div>
  );
}

function MustDoRow({ item }: { item: ActionItem }) {
  const actionFor = usePlanActionsStore((state) => state.actionsTaken.find((entry) => entry.key === item.key));
  const taken = Boolean(actionFor);

  return (
    <Card className="card-pop overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:gap-6 md:p-6">
        {/* Identity: logo + title + why + meta */}
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <InvestmentLogo name={item.title} extraHint={item.instrumentName} category={item.category} ticker={item.ticker} size="lg" />
          <div className="min-w-0">
            <p className="text-lg font-bold leading-snug text-foreground">{item.title}</p>
            <p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">Why: {item.reason}</p>
            <MetaChips item={item} />
            <FactorChips item={item} />
            <CommunityChip item={item} />
          </div>
        </div>

        {/* Money + action */}
        <div className="flex shrink-0 items-end justify-between gap-4 border-t border-border pt-4 md:flex-col md:items-end md:justify-center md:gap-3 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <AmountBlock item={item} />
          <TakeActionDialog
            payload={takePayload(item)}
            trigger={
              <Button
                size="lg"
                className={cn(
                  "min-w-[140px] justify-center",
                  taken && "bg-positive-soft text-positive-foreground hover:bg-positive-soft"
                )}
              >
                {taken ? (<><CheckCircle2 className="h-4 w-4" /> Done</>) : item.ctaLabel}
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function takePayload(item: ActionItem) {
  return {
    key: item.key,
    instrumentName: item.title,
    category: item.category,
    ticker: item.ticker,
    suggestedMonthlyAmount: item.suggestedMonthlyAmount,
    actionLabel: item.ctaLabel,
    reason: item.reason,
    expectedReturn: item.expectedReturn,
    risk: item.risk,
    kind: item.actionKind,
    goalName: item.goalName,
  };
}

function ConsiderRow({ item }: { item: ActionItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-surface-hover"
      >
        <InvestmentLogo name={item.title} extraHint={item.instrumentName} category={item.category} ticker={item.ticker} size="md" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold text-foreground">{item.title}</p>
          <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">Why: {item.reason}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">🎯 {purposeTag(item)}</span>
            <span className="inline-flex items-center rounded-full bg-surface-soft px-2 py-0.5 text-xs font-semibold text-foreground">{amountLabel(item)}</span>
          </div>
          <CommunityChip item={item} />
        </div>
        <span className="rounded-full p-1.5 text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {item.explanationCards.slice(0, 4).map((card) => (
              <div key={card.title} className="rounded-xl bg-surface-soft p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{friendlyQuestion(card.title)}</p>
                <p className="mt-1 text-sm text-foreground">{card.summary}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <TakeActionDialog
              payload={takePayload(item)}
              trigger={<Button variant="outline">{item.ctaLabel}</Button>}
            />
            {item.expectedReturn ? <p className="text-[13px] text-muted-foreground">Expected: ~{item.expectedReturn}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExploreRow({ item, divider }: { item: ActionItem; divider: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-3", divider && "border-b border-border")}>
      <InvestmentLogo name={item.title} extraHint={item.instrumentName} category={item.category} ticker={item.ticker} size="md" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium text-foreground">{item.title}</p>
        <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{item.reason}</p>
      </div>
      {hasMoneyAmount(item) ? (
        <span className="hidden shrink-0 text-xs font-semibold text-muted-foreground sm:inline">{inr(item.suggestedMonthlyAmount)}/mo</span>
      ) : null}
      <Link href="/asset-intelligence" className="text-sm font-medium text-primary hover:underline">
        View <ArrowRight className="inline h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" /> {text}
      </CardContent>
    </Card>
  );
}

function friendlyQuestion(title: string) {
  if (/recommended|seeing/i.test(title)) return "Why this fits you";
  if (/now|time/i.test(title)) return "Why now";
  if (/support|promising/i.test(title)) return "What supports it";
  if (/wrong|careful|risk/i.test(title)) return "What to be careful about";
  return title;
}
