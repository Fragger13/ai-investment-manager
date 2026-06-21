"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, TrendingUp, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { InvestmentLogo } from "@/components/investment-logo";
import { TakeActionDialog } from "@/components/take-action-dialog";
import { api } from "@/lib/api";
import { cn, inr } from "@/lib/utils";
import { emptyDashboard } from "@/lib/profile";
import { useAuthStore } from "@/store/auth-store";
import { usePlanActionsStore } from "@/store/plan-actions-store";
import { AdvancedRecommendation, AdvancedRecommendationResponse, CommunitySentiment, DashboardData, FundFactorInsights, GoalFundingPlan, GoalFundingStatus } from "@/types";

const emptyAdvanced: AdvancedRecommendationResponse = {
  recommendations: [],
  signals: [],
  assets: [],
  dataMode: "fallback",
  lastResearchedAt: "",
  sourceCount: 0,
  disclaimer: "These suggestions are here to help you decide what to review next. They are not promises of returns."
};

const tabs = ["Must Do", "Consider", "Explore"] as const;
const TAB_LABELS: Record<(typeof tabs)[number], string> = { "Must Do": "Do first", Consider: "Next up", Explore: "Worth a look" };
type TabName = (typeof tabs)[number];

// Unified action-plan item — covers fund recommendations AND non-investment actions
type ActionItem = {
  key: string;
  kind: "recommendation" | "action";
  actionKind: "fund" | "lump_sum" | "habit" | "debt" | "review";
  title: string;
  /** Original instrument name from the backend rec. Display uses `title`, but
   *  the icon resolver receives this too so AMC keywords aren't lost when the
   *  title is simplified (e.g. "Increase Nifty Index SIP"). */
  instrumentName?: string;
  reason: string;
  impact: "High" | "Medium" | "Low";
  confidence: number;
  category: string; // shown under title and used for the logo
  ticker: string;
  suggestedMonthlyAmount: number;
  expectedReturn?: string;
  risk?: string;
  bucket: TabName;
  goalName?: string;
  ctaLabel: string;
  explanationCards: { title: string; summary: string }[];
  isFundPick?: boolean;
  factorDrivers?: string[];
  factorInsights?: FundFactorInsights;
  goalFunding?: GoalFundingStatus;
  community?: CommunitySentiment;
};

export default function RecommendationsPage() {
  const profile = useAuthStore((state) => state.profile);
  const [data, setData] = useState<AdvancedRecommendationResponse>(emptyAdvanced);
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>("Must Do");

  async function load(refreshResearch = false) {
    setLoading(true);
    try {
      const [recs, dash] = await Promise.all([
        api.generateAdvancedRecommendations(profile, refreshResearch),
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
  const items = useMemo(() => mergeIntoActionItems(data.recommendations, dashboard), [data.recommendations, dashboard]);
  const grouped = useMemo(
    () => layerItems(items, new Set(actionsTaken.map((entry) => entry.key))),
    [items, actionsTaken]
  );
  const visible = grouped[activeTab];
  const confidence = planConfidence(items);
  const confidenceTone: "good" | "warn" | "danger" = confidence >= 75 ? "good" : confidence >= 55 ? "warn" : "danger";

  return (
    <AppShell sidebarExtra={<PlanProgressWidget confidence={confidence} />}>
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">Your money plan ✨</h1>
          <p className="mt-2 text-base text-muted-foreground">Simple steps, picked just for you. Do them one at a time — no finance degree needed.</p>
        </div>
        <PlanConfidenceCard confidence={confidence} tone={confidenceTone} />
      </div>

      <SavedByYouSection />

      <GoalFundingSection plan={data.goalFunding} />

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
        <Section heading="Do this first 💪" subtitle="The 3 things worth doing now. Knock one out and the next one pops up automatically.">
          <div className="space-y-3">
            {visible.map((item) => <MustDoRow key={item.key} item={item} />)}
            {!visible.length ? <EmptyRow text="You're all caught up here! 🎉 Peek at the Consider tab for what's next." /> : null}
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
          <h2 className="text-base font-semibold text-foreground">Saved by you</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Investments you added from Discover.</p>
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
                    <p className="text-xs text-muted-foreground">{item.category}{item.ticker ? ` · ${item.ticker}` : ""}</p>
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

function GoalFundingSection({ plan }: { plan?: GoalFundingPlan }) {
  if (!plan || !plan.goals?.length) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Will this plan reach your goals?</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Your investable surplus mapped to each goal, priority first. Honest funding — not a promise.</p>
        </div>
        <Badge tone={plan.fullyFundsAll ? "good" : "warn"}>{plan.fullyFundsAll ? "On track" : "Gaps to close"}</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {plan.goals.map((goal) => {
          const tone = goal.fundingPercent >= 98 ? "good" : goal.fundingPercent >= 60 ? "warn" : "danger";
          return (
            <Card key={goal.id}>
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-foreground">{goal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Needs {inr(goal.requiredMonthlyInvestment)}/mo · allocated {inr(goal.allocatedMonthlyInvestment)}/mo
                    </p>
                  </div>
                  <span className={cn("shrink-0 text-sm font-semibold", tone === "good" ? "text-positive-foreground" : tone === "warn" ? "text-warning-foreground" : "text-negative-foreground")}>
                    {goal.fundingPercent}% funded
                  </span>
                </div>
                <Progress value={goal.fundingPercent} className="mt-2 h-1.5" />
                {goal.fix ? <p className="mt-2 text-xs text-muted-foreground">{goal.fix}</p> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
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
        <span key={chip} className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-muted-foreground">{chip}</span>
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
        className="inline-flex items-center gap-1 rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-muted-foreground"
      >
        {emoji} Reddit: {label} · {c.mentionCount} mention{c.mentionCount === 1 ? "" : "s"}
        {subs ? ` (${subs})` : ""}
      </span>
    </div>
  );
}

function Section({ heading, subtitle, children }: { heading: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
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
          <p className="text-xs text-muted-foreground">Plan Confidence</p>
          <p className="text-xl font-semibold text-foreground">{confidence}%</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanProgressWidget({ confidence }: { confidence: number }) {
  return (
    <div className="rounded-2xl border border-positive-soft bg-positive-soft/60 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-positive-soft">
          <TrendingUp className="h-4 w-4 text-positive-foreground" />
        </span>
        <p className="text-sm font-semibold text-foreground">Keep going!</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">You&apos;re making great progress towards your goals.</p>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{confidence}% confidence</span>
        </div>
        <Progress value={confidence} className="mt-1.5 h-1.5" />
      </div>
    </div>
  );
}

function MustDoRow({ item }: { item: ActionItem }) {
  const actionFor = usePlanActionsStore((state) => state.actionsTaken.find((entry) => entry.key === item.key));
  const taken = Boolean(actionFor);

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid items-center gap-6 px-7 py-6 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        {/* Left: bigger logo + title/why */}
        <div className="flex min-w-0 items-center gap-5">
          <InvestmentLogo name={item.title} extraHint={item.instrumentName} category={item.category} ticker={item.ticker} size="lg" />
          <div className="min-w-0">
            <p className="line-clamp-1 text-lg font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">Why: {item.reason}</p>
            <FactorChips item={item} />
            <CommunityChip item={item} />
          </div>
        </div>

        {/* Impact column with right divider */}
        <div className="hidden min-w-[110px] flex-col items-center border-r border-border px-6 text-center md:flex">
          <p className="text-xs font-medium text-muted-foreground">Impact</p>
          <p className={cn("mt-1 text-base font-semibold", impactColor(item.impact))}>{item.impact}</p>
        </div>

        {/* Confidence column with right divider */}
        <div className="hidden min-w-[110px] flex-col items-center border-r border-border px-6 text-center md:flex">
          <p className="text-xs font-medium text-muted-foreground">Confidence</p>
          <p className="mt-1 text-base font-semibold text-positive-foreground">{item.confidence}%</p>
        </div>

        {/* Mobile-only inline Impact + Confidence row */}
        <div className="flex items-center gap-6 md:hidden">
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground">Impact</p>
            <p className={cn("mt-0.5 text-sm font-semibold", impactColor(item.impact))}>{item.impact}</p>
          </div>
          <span className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground">Confidence</p>
            <p className="mt-0.5 text-sm font-semibold text-positive-foreground">{item.confidence}%</p>
          </div>
        </div>

        <TakeActionDialog
          payload={takePayload(item)}
          trigger={
            <Button
              size="lg"
              className={cn(
                "w-full md:w-auto md:min-w-[140px] md:justify-self-end",
                taken && "bg-positive-soft text-positive-foreground hover:bg-positive-soft"
              )}
            >
              {taken ? (<><CheckCircle2 className="h-4 w-4" /> Done</>) : item.ctaLabel}
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

function impactColor(impact: ActionItem["impact"]) {
  if (impact === "High") return "text-positive-foreground";
  if (impact === "Medium") return "text-warning-foreground";
  return "text-muted-foreground";
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
    <div className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-hover"
      >
        <InvestmentLogo name={item.title} extraHint={item.instrumentName} category={item.category} ticker={item.ticker} size="md" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold text-foreground">{item.title}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">Why: {item.reason}</p>
          <CommunityChip item={item} />
        </div>
        <Badge tone="warn" className="hidden sm:inline-flex">{item.confidence}%</Badge>
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
                <p className="mt-1 text-sm text-foreground/85">{card.summary}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <TakeActionDialog
              payload={takePayload(item)}
              trigger={<Button variant="outline">{item.ctaLabel}</Button>}
            />
            <p className="text-xs text-muted-foreground">Impact: {item.impact}</p>
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
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.reason}</p>
      </div>
      <Link href="/asset-intelligence" className="text-sm font-medium text-primary hover:underline">
        View <ArrowRight className="inline h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}

// ---------- Merge logic: fund recommendations + non-investment actions ----------

function mergeIntoActionItems(recs: AdvancedRecommendation[], dashboard: DashboardData): ActionItem[] {
  const items: ActionItem[] = [];

  // 1) Non-investment / behavioral actions derived from the dashboard
  const synthesized = synthesizeActions(dashboard);
  items.push(...synthesized);

  // 2) Fund recommendations from the advanced engine
  recs.forEach((rec) => {
    items.push(recToItem(rec));
  });

  // Deduplicate by category-y key (e.g., emergency fund coming both from recs and synth)
  const seen = new Set<string>();
  return items.filter((item) => {
    const dedup = dedupKey(item);
    if (seen.has(dedup)) return false;
    seen.add(dedup);
    return true;
  });
}

function synthesizeActions(dashboard: DashboardData): ActionItem[] {
  const out: ActionItem[] = [];

  // Emergency fund
  if (dashboard.health.emergencyFundMonths < 6) {
    const monthsBehind = Math.max(0, 6 - dashboard.health.emergencyFundMonths);
    out.push({
      key: "action-emergency-fund",
      kind: "action",
      actionKind: "fund",
      title: "Build Emergency Fund",
      reason: `${monthsBehind.toFixed(0)}-month gap to reach 6 months of expenses.`,
      impact: dashboard.health.emergencyFundMonths < 3 ? "High" : "Medium",
      confidence: 92,
      category: "Emergency fund",
      ticker: "",
      suggestedMonthlyAmount: Math.max(Math.round((dashboard.summary.investableSurplus || 20000) * 0.4 / 500) * 500, 2000),
      bucket: "Must Do",
      ctaLabel: "Start transfer",
      explanationCards: [
        { title: "Why this fits you", summary: "Emergency money protects you from job loss, medical costs, or sudden expenses." },
        { title: "What supports it", summary: "Your current cash buffer is below the typical 6-month comfort level." },
        { title: "What to be careful about", summary: "Keep this in liquid funds or a savings account — not in equities." },
        { title: "What to do next", summary: "Set up a monthly transfer to a liquid/overnight fund or savings account." },
      ],
    });
  }

  // Debt burden
  if (dashboard.health.debtBurden > 35) {
    out.push({
      key: "action-avoid-new-debt",
      kind: "action",
      actionKind: "debt",
      title: "Avoid New Debt",
      reason: `EMIs are at ${dashboard.health.debtBurden.toFixed(0)}% of income — above 35%.`,
      impact: "High",
      confidence: 90,
      category: "Debt repayment",
      ticker: "",
      suggestedMonthlyAmount: 0,
      bucket: "Must Do",
      ctaLabel: "Commit to this",
      explanationCards: [
        { title: "Why this fits you", summary: "Adding more EMIs would crowd out your ability to save and invest for goals." },
        { title: "What to do next", summary: "Pause new loans until debt is below 35% of income." },
      ],
    });
  }

  // Behavior / panic selling
  if (dashboard.behavior.panicSellingRisk === "High") {
    out.push({
      key: "action-stay-the-course",
      kind: "action",
      actionKind: "habit",
      title: "Stick to your SIP routine",
      reason: "Your answers suggest selling investments when markets fall.",
      impact: "Medium",
      confidence: 80,
      category: "review",
      ticker: "",
      suggestedMonthlyAmount: 0,
      bucket: "Consider",
      ctaLabel: "Commit to habit",
      explanationCards: [
        { title: "Why this fits you", summary: "Selling in a downturn locks in losses; staying invested usually recovers." },
        { title: "What to do next", summary: "Use smaller monthly SIPs so a fall feels manageable, and avoid daily checks." },
      ],
    });
  }

  // Savings rate
  if (dashboard.health.savingsRate < 20 && dashboard.summary.investableSurplus > 0) {
    out.push({
      key: "action-increase-savings",
      kind: "action",
      actionKind: "habit",
      title: "Increase savings rate",
      reason: `Saving ${dashboard.health.savingsRate.toFixed(0)}% — under the 25% comfort range.`,
      impact: "Medium",
      confidence: 78,
      category: "savings",
      ticker: "",
      suggestedMonthlyAmount: Math.max(Math.round(dashboard.summary.monthlyIncome * 0.05 / 500) * 500, 1000),
      bucket: "Must Do",
      ctaLabel: "Set a target",
      explanationCards: [
        { title: "Why this fits you", summary: "A higher savings rate makes every other goal easier." },
        { title: "What to do next", summary: "Trim one flexible expense category by ~5% and route it to a goal." },
      ],
    });
  }

  // Goal-driven nudges (off-track top goal)
  const offTrack = dashboard.goals.find((goal) => (goal.feasibilityScore || 100) < 60);
  if (offTrack) {
    out.push({
      key: `action-goal-${offTrack.id}`,
      kind: "action",
      actionKind: "lump_sum",
      title: `Catch up on ${offTrack.name}`,
      reason: `On track to miss this goal. Needs ${inr(offTrack.requiredMonthlyInvestment)}/month.`,
      impact: "High",
      confidence: 82,
      category: offTrack.name,
      ticker: "",
      suggestedMonthlyAmount: offTrack.requiredMonthlyInvestment || 0,
      bucket: "Must Do",
      goalName: offTrack.name,
      ctaLabel: "Boost contribution",
      explanationCards: [
        { title: "Why this fits you", summary: `${offTrack.name} is one of your saved goals and is currently behind schedule.` },
        { title: "What supports it", summary: "Adding monthly contribution gets the goal back on its target timeline." },
      ],
    });
  }

  return out;
}

function recToItem(rec: AdvancedRecommendation): ActionItem {
  const explanation = explanationCardsFor(rec);
  const title = friendlyTitle(rec);
  return {
    key: keyOf(rec),
    kind: "recommendation",
    actionKind: "fund",
    title,
    instrumentName: rec.instrumentName || rec.recommendationTitle || "",
    reason: shortReason(rec, explanation),
    impact: bucketImpact(rec),
    confidence: rec.confidenceScore || rec.convictionScore || 0,
    category: rec.assetType || rec.assetClass || rec.recommendationType || "Investment",
    ticker: rec.ticker || "",
    suggestedMonthlyAmount: rec.suggestedMonthlyAmount || 0,
    expectedReturn: formatExpectedReturn(rec),
    risk: rec.riskLevel,
    bucket: rec.confidenceScore >= 75 || rec.goalPriority <= 1 ? "Must Do" : rec.confidenceScore >= 55 ? "Consider" : "Explore",
    goalName: rec.linkedGoals?.[0]?.name || rec.goalTag,
    ctaLabel: "Take Action",
    explanationCards: explanation,
    isFundPick: rec.isFundPick,
    factorDrivers: rec.factorDrivers,
    factorInsights: rec.factorInsights,
    goalFunding: rec.goalFunding,
    community: (rec.sentimentSignal as { community?: CommunitySentiment } | undefined)?.community,
  };
}

function shortReason(rec: AdvancedRecommendation, cards: { summary: string }[]) {
  const goal = rec.linkedGoals?.[0]?.name || rec.goalTag;
  if (goal) return `Supports your ${goal} Goal`;
  const first = cards[0]?.summary || rec.conciseReason || rec.whyThisMatters || rec.userSpecificReasoning || "Supports your overall plan.";
  const sentence = first.split(/(?<=[.!?])\s+/)[0].replace(/[.!?]+$/, "");
  return sentence.length > 80 ? `${sentence.slice(0, 78)}…` : sentence;
}

// Cap the active plan at the 3 highest-priority pending actions. Everything
// else cascades into Consider, then Explore. Completed actions are dropped from
// the active plan so finishing one automatically promotes the next item up —
// the plan keeps updating and re-ordering itself as the user makes progress.
const MUST_DO_LIMIT = 3;
const CONSIDER_LIMIT = 8;
const EXPLORE_LIMIT = 15;

function priorityScore(item: ActionItem): number {
  const bucketWeight = item.bucket === "Must Do" ? 2 : item.bucket === "Consider" ? 1 : 0;
  return bucketWeight * 1000 + impactRank(item.impact) * 100 + item.confidence;
}

function layerItems(items: ActionItem[], takenKeys: Set<string>): Record<TabName, ActionItem[]> {
  const ranked = items
    .filter((item) => !takenKeys.has(item.key))
    .sort((a, b) => priorityScore(b) - priorityScore(a));
  const mustDo = ranked.slice(0, MUST_DO_LIMIT);
  const overflow = ranked.slice(MUST_DO_LIMIT);
  return {
    "Must Do": mustDo,
    Consider: overflow.slice(0, CONSIDER_LIMIT),
    Explore: overflow.slice(CONSIDER_LIMIT, CONSIDER_LIMIT + EXPLORE_LIMIT),
  };
}

function impactRank(impact: ActionItem["impact"]): number {
  return impact === "High" ? 3 : impact === "Medium" ? 2 : 1;
}

function planConfidence(items: ActionItem[]): number {
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, item) => sum + item.confidence, 0) / items.length);
}

function bucketImpact(rec: AdvancedRecommendation): ActionItem["impact"] {
  if (rec.goalImpacts?.[0]?.label) {
    const label = rec.goalImpacts[0].label.toLowerCase();
    if (label.includes("high")) return "High";
    if (label.includes("medium")) return "Medium";
    if (label.includes("low")) return "Low";
  }
  const score = rec.importanceScore || rec.confidenceScore || 0;
  if (score >= 75) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}

function dedupKey(item: ActionItem): string {
  const norm = item.title.toLowerCase().replace(/[^a-z]+/g, "");
  if (norm.includes("emergency")) return "emergency-fund";
  if (norm.includes("avoidnewdebt")) return "debt-action";
  return item.key;
}

function friendlyQuestion(title: string) {
  if (/recommended|seeing/i.test(title)) return "Why this fits you";
  if (/now|time/i.test(title)) return "Why now";
  if (/support|promising/i.test(title)) return "What supports it";
  if (/wrong|careful|risk/i.test(title)) return "What to be careful about";
  return title;
}

function explanationCardsFor(rec: AdvancedRecommendation) {
  if (rec.explanation_cards?.length) return rec.explanation_cards.map((item) => ({ title: item.question, summary: item.answer }));
  if (rec.explanationCards?.length) return rec.explanationCards;
  return [
    { title: "Why this fits you", summary: rec.userSpecificReasoning || "Matches your saved profile and goals." },
    { title: "Why now", summary: rec.currentMarketReasoning || rec.whyNow || "A gradual approach suits current market." },
    { title: "What supports it", summary: rec.supportingSignals?.[0]?.summary || "Supporting signals are being refreshed." },
    { title: "What to be careful about", summary: rec.whatCanGoWrong || rec.riskExplanation || "Market values can move up and down." },
  ];
}

function friendlyTitle(rec: AdvancedRecommendation): string {
  const name = rec.instrumentName || "";
  const action = (rec.action || "").toLowerCase();
  if (action.includes("watch")) return `Review ${name}`;
  if (action.includes("avoid")) return `Avoid ${name}`;
  if (/emergency/i.test(name)) return "Build Emergency Fund";
  if (/sip|equity|nifty|index/i.test(name)) return `Increase ${trim(name)} SIP`;
  if (/debt|liquid/i.test(name)) return `Add ${trim(name)}`;
  if (/gold|sgb/i.test(name)) return `Add ${trim(name)}`;
  return trim(name);
}

function trim(value: string) {
  return value.length > 60 ? `${value.slice(0, 58)}…` : value;
}

function keyOf(rec: AdvancedRecommendation): string {
  return String(rec.recommendationKey || rec.id || rec.instrumentName || "");
}

function formatExpectedReturn(rec: AdvancedRecommendation) {
  const expected = rec.expectedReturn;
  if (expected?.label) return expected.label.replace(/CAGR/gi, "p.a.");
  if (expected?.cagrRange) return `${expected.cagrRange} p.a.`;
  if (typeof expected?.expectedCagr === "number") return `${expected.expectedCagr}% p.a.`;
  if (rec.expectedReturnRange) return rec.expectedReturnRange;
  return "";
}
