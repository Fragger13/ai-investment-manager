"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, Sparkles, TrendingUp, X } from "lucide-react";
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
  amountLabel,
  buildPlan,
  hasMoneyAmount,
  idealNote,
  mergeIntoActionItems,
  planConfidence,
  purposeTag,
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
  // One-time lump sums don't recur, so they don't reduce the monthly budget.
  const committedMonthly = useMemo(() => actionsTaken.filter((a) => a.cadence !== "one_time").reduce((sum, a) => sum + (a.amount || 0), 0), [actionsTaken]);
  const available = useMemo(() => availableToInvest(profile, dashboard.summary.monthlyIncome, committedMonthly), [profile, dashboard.summary.monthlyIncome, committedMonthly]);
  const grouped = useMemo(() => buildPlan(items, takenKeys, available, true), [items, takenKeys, available]);
  const visible = grouped["Must Do"];
  const pendingVisible = useMemo(() => visible.filter((item) => !takenKeys.has(item.key)), [visible, takenKeys]);
  const doneVisible = useMemo(() => visible.filter((item) => takenKeys.has(item.key)), [visible, takenKeys]);
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

      <Section
        subtitle={available > 0
          ? `Your top 3, sized to the ${inr(available)} you have to invest this month. Tick one off — it drops to Completed below.`
          : "Your top 3 things worth doing now. Tick one off and it drops to Completed below."}
        action={
          <Button variant="outline" onClick={() => load(true)} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> {loading ? "Refreshing..." : "Refresh plan"}
          </Button>
        }
      >
        {visible.length > 0 ? <DoFirstProgress done={doneVisible.length} total={visible.length} /> : null}
        <div className="space-y-3">
          {pendingVisible.map((item) => <MustDoRow key={item.key} item={item} />)}
          {!visible.length ? (
            <EmptyRow text="Refresh after completing your profile to see your first steps." />
          ) : null}
          {doneVisible.length ? (
            <div className="pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed ✓</p>
              <div className="space-y-3">
                {doneVisible.map((item) => <MustDoRow key={item.key} item={item} />)}
              </div>
            </div>
          ) : null}
        </div>
      </Section>
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
function AmountBlock({ item, committedAmount, committedCadence }: { item: ActionItem; committedAmount?: number; committedCadence?: "monthly" | "one_time" }) {
  // Once an action is taken, show what the user actually committed (not the
  // budget-calibrated suggestion or the goal's full need) so the figure on the
  // Completed card matches what they set up and never jumps after ticking off.
  if (committedAmount && committedAmount > 0) {
    return (
      <div className="md:text-right">
        <p className="text-2xl font-extrabold tracking-tight text-foreground">{inr(committedAmount)}</p>
        <p className="text-[13px] font-medium text-muted-foreground">{committedCadence === "one_time" ? "committed · one-time" : "committed / month"}</p>
      </div>
    );
  }
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

function Section({ heading, subtitle, action, children }: { heading?: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      {heading ? <h2 className="ap-section">{heading}</h2> : null}
      <div className="flex items-start justify-between gap-4">
        <p className={cn("text-[15px] leading-relaxed text-muted-foreground", heading && "mt-1")}>{subtitle}</p>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
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
  const proof = proofFor(item);

  return (
    <Card className={cn("card-pop overflow-hidden transition", taken && "bg-surface-soft opacity-60")}>
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        {/* Identity: logo + title + why + meta */}
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <InvestmentLogo name={item.title} extraHint={item.instrumentName} category={item.category} ticker={item.ticker} size="lg" />
          <div className="min-w-0">
            <p className={cn("text-lg font-bold leading-snug text-foreground", taken && "text-muted-foreground line-through")}>{item.title}</p>
            {taken ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-[15px] font-semibold text-positive-foreground">
                <CheckCircle2 className="h-4 w-4" /> Done — nice work!
              </p>
            ) : (
              <>
                <p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">Why: {item.reason}</p>
                <MetaChips item={item} />
                <FactorChips item={item} />
                <CommunityChip item={item} />
              </>
            )}
          </div>
        </div>

        {/* Money + action */}
        <div className="flex shrink-0 items-end justify-between gap-4 border-t border-border pt-4 md:flex-col md:items-end md:justify-center md:gap-3 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <AmountBlock item={item} committedAmount={taken ? actionFor?.amount : undefined} committedCadence={actionFor?.cadence} />
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
        </div>

        {/* "If you start this" — the projected payoff of acting now */}
        {!taken && proof ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-positive/20 bg-positive-soft/50 p-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-positive-soft text-positive-foreground">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-positive-foreground">If you start this</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">{proof}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// "If you start this" projection — an honest, beginner-friendly payoff line.
function annualRateFromReturn(label?: string): number {
  if (!label) return 0.08;
  const nums = (label.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => n > 0 && n < 60);
  if (!nums.length) return 0.08;
  const avg = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
  return Math.min(Math.max(avg / 100, 0.03), 0.16);
}

function sipFutureValue(monthly: number, annualRate: number, months = 12): number {
  const i = annualRate / 12;
  if (i <= 0) return monthly * months;
  return Math.round(monthly * ((Math.pow(1 + i, months) - 1) / i));
}

function proofFor(item: ActionItem): string | null {
  const amt = item.suggestedMonthlyAmount;
  if (amt <= 0) return null; // behavioural actions have no money projection
  const cat = `${item.category} ${item.title}`.toLowerCase();
  if (/emergency|safety|liquid|saving|cash/.test(cat)) {
    return `Sets aside ${inr(amt)}/mo toward your safety net — about ${inr(amt * 12)} in a year, with near-zero risk.`;
  }
  const fv = inr(sipFutureValue(amt, annualRateFromReturn(item.expectedReturn)));
  const bits = [`${inr(amt)}/mo grows to about ${fv} in a year.`];
  const fi = item.factorInsights;
  if (fi?.maxDrawdown3y != null) bits.push(`Worst 3-yr drop: ${fi.maxDrawdown3y}%.`);
  if (fi?.sortino != null) bits.push(`Sortino ${fi.sortino} — steady.`);
  return bits.join(" ");
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

function EmptyRow({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" /> {text}
      </CardContent>
    </Card>
  );
}

