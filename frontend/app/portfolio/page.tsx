"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { ArrowRight, ArrowUpRight, CheckCircle2, Pencil, RefreshCw, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { AppShell } from "@/components/app-shell";
import { PortfolioBuckets } from "@/app/onboarding/_screens/assets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { InvestmentLogo } from "@/components/investment-logo";
import { api, ApiError } from "@/lib/api";
import { availableToInvest } from "@/lib/profile";
import { useEnsureProfile } from "@/lib/use-ensure-profile";
import { cn, inr } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { usePlanActionsStore } from "@/store/plan-actions-store";
import { OnboardingProfile, PortfolioHolding, PortfolioSummary } from "@/types";

const empty: PortfolioSummary = {
  netWorth: 0,
  baseNetWorth: 0,
  actionContributedValue: 0,
  monthlyIncome: 0,
  monthlyExpenses: 0,
  monthlyCommitments: 0,
  investableSurplus: 0,
  committedMonthly: 0,
  holdings: [],
  allocation: [],
  projection: [],
  recentActions: [],
  insights: [],
  generatedAt: "",
};

export default function PortfolioPage() {
  // Self-heal the profile (like the Dashboard) so "available this month" and
  // every other profile-derived figure match across tabs even on a direct load.
  const profile = useEnsureProfile();
  const saveProfile = useAuthStore((state) => state.saveProfile);
  const planItems = usePlanActionsStore((state) => state.planItems);
  const actionsTaken = usePlanActionsStore((state) => state.actionsTaken);
  const [data, setData] = useState<PortfolioSummary>(empty);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState(false);
  const [pricedAt, setPricedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.portfolioSummary(profile);
      setData(result);
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "Could not load portfolio.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshPrices() {
    if (!profile || !(profile.holdings || []).length) return;
    setPricing(true);
    setError(null);
    try {
      const result = await api.refreshHoldingPrices(profile.holdings);
      saveProfile({ ...profile, holdings: result.holdings }, false);
      setPricedAt(result.refreshedAt);
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "Live price refresh failed.";
      setError(message);
    } finally {
      setPricing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Recurring SIPs only — one-time lump sums don't reduce the monthly budget.
  const localCommitments = useMemo(() => actionsTaken.filter((action) => action.cadence !== "one_time").reduce((sum, action) => sum + (action.amount || 0), 0), [actionsTaken]);
  const totalCommitments = Math.max(data.committedMonthly, localCommitments);
  // Same "available this month" the dashboard + plan use (respects the per-month
  // override), so the Portfolio figure no longer contradicts them.
  const available = availableToInvest(profile, data.monthlyIncome, localCommitments);
  const startedActions = actionsTaken.length;
  const watchlistedItems = planItems.length;

  const projection = data.projection;
  const projectedAt12 = projection[12]?.value || 0;
  const projectedAt24 = projection[24]?.value || 0;
  const actionContributedValue = data.actionContributedValue || 0;
  const baseNetWorth = data.baseNetWorth ?? Math.max(0, data.netWorth - actionContributedValue);

  // Keep the "Room to invest more" insight in lockstep with the hero's
  // "Available this month" figure (which respects the per-month override and
  // already-committed actions) — the backend insight uses raw surplus and drifts.
  const syncedInsights = useMemo(
    () => (data.insights || []).map((insight) => {
      if (!/room to invest/i.test(insight.title)) return insight;
      return available > 0
        ? { ...insight, body: `About ${inr(available)}/mo is available this month. Adding plan actions routes this surplus to your goals.` }
        : { ...insight, tone: "warning" as typeof insight.tone, title: "Fully allocated this month", body: "Your available-to-invest is committed for now. Free up budget or wait for next month to add more." };
    }),
    [data.insights, available],
  );

  // P&L is the sum of (currentValue - valueAtCost) across holdings that have a cost basis.
  const { totalInvested, plRupees, plPercent, plHoldingCount } = useMemo(() => {
    let invested = 0;
    let current = 0;
    let count = 0;
    for (const h of data.holdings) {
      if (h.valueAtCost && h.valueAtCost > 0) {
        invested += h.valueAtCost;
        current += h.value;
        count += 1;
      }
    }
    const rupees = current - invested;
    const percent = invested > 0 ? (rupees / invested) * 100 : 0;
    return { totalInvested: invested, totalCurrent: current, plRupees: rupees, plPercent: percent, plHoldingCount: count };
  }, [data.holdings]);

  return (
    <AppShell sidebarExtra={<PortfolioSidebarWidget startedActions={startedActions} committed={totalCommitments} />}>
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">Your portfolio 💰</h1>
          <p className="mt-2 text-base text-muted-foreground">What you own, what you&apos;ve started, and where it&apos;s all heading.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(profile?.holdings || []).length > 0 ? (
            <Button variant="outline" onClick={refreshPrices} disabled={pricing || loading} title={pricedAt ? `Last refreshed ${pricedAt}` : "Pull live prices for stocks, MFs, crypto, gold/silver"}>
              <TrendingUp className={cn("h-4 w-4", pricing && "animate-pulse")} /> {pricing ? "Pricing..." : "Refresh live prices"}
            </Button>
          ) : null}
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="mb-6 border-negative/30 bg-negative-soft/40">
          <CardContent className="p-4 text-sm text-negative-foreground">{error}</CardContent>
        </Card>
      ) : null}

      {/* Hero — Net Worth */}
      <Card className="relative mb-6 overflow-hidden">
        <CardContent className="p-6">
          <div className="absolute right-4 top-4 z-10">
            <EditInvestmentsDialog onSaved={load} />
          </div>
          <p className="ap-label">Total Net Worth</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-3">
            <p className="text-5xl font-extrabold tracking-tight text-foreground md:text-6xl tnum">{inr(data.netWorth)}</p>
            <div className="flex flex-wrap items-center gap-2 pb-1.5">
              {plHoldingCount > 0 ? (
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold", plRupees >= 0 ? "bg-positive-soft text-positive-foreground" : "bg-negative-soft text-negative-foreground")}>
                  {plRupees >= 0 ? "+" : "−"}{inr(Math.abs(plRupees))} · {plPercent >= 0 ? "+" : "−"}{Math.abs(plPercent).toFixed(2)}% P&L
                </span>
              ) : null}
              {actionContributedValue > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-3 py-1.5 text-sm font-bold text-positive-foreground">+{inr(actionContributedValue)} from your actions</span>
              ) : null}
            </div>
          </div>
          <p className="mt-2.5 inline-flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <ArrowUpRight className="h-4 w-4 text-positive-foreground" />
            Projected to grow to <span className="font-semibold text-foreground">{inr(projectedAt12)}</span> in 12 months
            {plHoldingCount > 0 ? <span className="text-muted-foreground">· on a cost basis of {inr(totalInvested)}</span> : null}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <Pill label="Base assets" value={inr(baseNetWorth)} icon={Wallet} tone="neutral" />
            <Pill label="From plan actions" value={actionContributedValue ? inr(actionContributedValue) : "—"} icon={CheckCircle2} tone="positive" />
            <Pill label="Active commitments" value={totalCommitments ? `${inr(totalCommitments)}/mo` : "—"} icon={ArrowUpRight} tone="positive" />
            <Pill label="Available this month" value={inr(available)} icon={Sparkles} tone="info" />
          </div>
          <p className="mt-3 text-[13px] text-muted-foreground">{watchlistedItems} idea{watchlistedItems === 1 ? "" : "s"} saved in your plan, ready to start.</p>
        </CardContent>
      </Card>

      {/* Insights — clean aligned strip (dot + title + body) */}
      {syncedInsights.length ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {syncedInsights.slice(0, 3).map((insight, index) => <InsightTile key={index} insight={insight} />)}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Holdings — interactive allocation chart + drill-down to the full list */}
        <HoldingsCard data={data} />

        {/* Projection */}
        <Card>
          <CardContent className="p-6">
            <p className="text-lg font-bold tracking-tight text-foreground">Projected wealth</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Based on current holdings + monthly commitments from your plan.</p>
            {projection.length ? (
              <div className="mt-4 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projection.map((point, index) => ({ ...point, label: index }))}>
                    <defs>
                      <linearGradient id="projfill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" hide />
                    <YAxis hide />
                    <Tooltip formatter={(value: number) => inr(value)} labelFormatter={(label) => `Month ${label}`} />
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#projfill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-surface-soft p-3">
                <p className="text-[13px] text-muted-foreground">In 12 months</p>
                <p className="mt-0.5 text-lg font-bold text-foreground tnum">{inr(projectedAt12)}</p>
              </div>
              <div className="rounded-xl bg-surface-soft p-3">
                <p className="text-[13px] text-muted-foreground">In 24 months</p>
                <p className="mt-0.5 text-lg font-bold text-foreground tnum">{inr(projectedAt24)}</p>
              </div>
            </div>
            {totalCommitments > 0 ? (
              <p className="mt-4 text-[13px] text-muted-foreground">Includes {inr(totalCommitments)}/month from plan actions. Action-built holdings continue to grow each month.</p>
            ) : (
              <p className="mt-4 text-[13px] text-muted-foreground">Start any action in your plan to see new contributions show up here automatically.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

const CHART_COLORS = [
  "hsl(var(--chart-series-1))",
  "hsl(var(--chart-series-2))",
  "hsl(var(--chart-series-3))",
  "hsl(var(--chart-series-4))",
  "hsl(var(--chart-series-5))",
  "hsl(var(--chart-series-6))",
  "hsl(var(--chart-series-7))",
];

function deriveAllocation(holdings: PortfolioHolding[]) {
  const byCategory = new Map<string, number>();
  for (const holding of holdings) {
    const key = holding.category || "Other";
    byCategory.set(key, (byCategory.get(key) || 0) + holding.value);
  }
  return Array.from(byCategory.entries())
    .map(([name, value]) => ({ name, value, color: "" }))
    .sort((a, b) => b.value - a.value);
}

function HoldingsCard({ data }: { data: PortfolioSummary }) {
  const [active, setActive] = useState<number | null>(null);
  const allocation = useMemo(() => {
    const base = data.allocation?.length ? data.allocation : deriveAllocation(data.holdings);
    return base
      .filter((slice) => slice.value > 0)
      .map((slice, index) => ({ ...slice, color: slice.color || CHART_COLORS[index % CHART_COLORS.length] }));
  }, [data.allocation, data.holdings]);
  const total = allocation.reduce((sum, slice) => sum + slice.value, 0);

  if (!data.holdings.length) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-lg font-bold tracking-tight text-foreground">Holdings mix</p>
          <div className="mt-4 rounded-xl bg-surface-soft p-6 text-center text-sm text-muted-foreground">
            <p>No holdings yet.</p>
            <p className="mt-1">Add your existing investments in your profile, or take action on a recommendation.</p>
            <Button asChild className="mt-3" size="sm"><Link href="/asset-intelligence">Browse ideas <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeSlice = active != null ? allocation[active] : null;
  const centerLabel = activeSlice ? activeSlice.name : "Net worth";
  const centerValue = activeSlice ? activeSlice.value : data.netWorth;
  const centerPct = activeSlice && total ? Math.round((activeSlice.value / total) * 100) : null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-bold tracking-tight text-foreground">Holdings mix</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Where your money sits today. Hover a slice for detail.</p>
          </div>
          <HoldingsDetailDialog data={data} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[240px_1fr] sm:items-center">
          <div className="relative mx-auto h-[240px] w-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocation}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={82}
                  outerRadius={116}
                  paddingAngle={2}
                  stroke="none"
                  onMouseEnter={(_, index) => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                >
                  {allocation.map((slice, index) => (
                    <Cell
                      key={slice.name}
                      fill={slice.color}
                      opacity={active == null || active === index ? 1 : 0.4}
                      style={{ cursor: "pointer", transition: "opacity 150ms ease" }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="max-w-[110px] truncate text-xs font-semibold text-muted-foreground">{centerLabel}</span>
              <span className="text-xl font-extrabold tracking-tight text-foreground tnum">{inr(centerValue)}</span>
              {centerPct != null ? <span className="text-xs font-bold text-primary">{centerPct}%</span> : null}
            </div>
          </div>

          <ul className="space-y-1">
            {allocation.map((slice, index) => {
              const pct = total ? Math.round((slice.value / total) * 100) : 0;
              return (
                <li
                  key={slice.name}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 transition", active === index && "bg-surface-soft")}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">{slice.name}</span>
                  <span className="shrink-0 text-sm font-bold text-foreground">{pct}%</span>
                  <span className="ml-auto shrink-0 text-[13px] font-semibold text-muted-foreground tnum">{inr(slice.value)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function groupHoldingsByClass(holdings: PortfolioHolding[]): [string, PortfolioHolding[]][] {
  const map = new Map<string, PortfolioHolding[]>();
  for (const holding of holdings) {
    // Group by the same granular label the pie/legend uses, so sections match the chart.
    const key = holding.allocationCategory || holding.category || "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(holding);
  }
  // Sections ordered by total value so the biggest asset class leads.
  return Array.from(map.entries()).sort(
    (a, b) => b[1].reduce((s, h) => s + h.value, 0) - a[1].reduce((s, h) => s + h.value, 0)
  );
}

function HoldingsDetailDialog({ data }: { data: PortfolioSummary }) {
  const groups = useMemo(() => groupHoldingsByClass(data.holdings), [data.holdings]);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">View all holdings ({data.holdings.length})</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[min(680px,94vw)] overflow-y-auto p-0">
        <div className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-lg font-semibold text-foreground">Your holdings</DialogTitle>
          <DialogDescription className="mt-0.5 text-[13px] text-muted-foreground">
            All {data.holdings.length} holdings, grouped by asset class — including value built up from plan actions. Cost &amp; returns shown where available.
          </DialogDescription>
        </div>
        <div className="space-y-6 p-6">
          {groups.map(([assetClass, holdings]) => {
            const subtotal = holdings.reduce((sum, holding) => sum + holding.value, 0);
            const pct = data.netWorth > 0 ? Math.round((subtotal / data.netWorth) * 100) : 0;
            return (
              <div key={assetClass}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-bold tracking-tight text-foreground">{assetClass} <span className="ml-1 text-[13px] font-medium text-muted-foreground">({holdings.length})</span></h3>
                  <span className="text-[13px] font-semibold text-muted-foreground tnum">{inr(subtotal)} · {pct}%</span>
                </div>
                <div className="space-y-2">
                  {holdings.map((holding) => <HoldingRow key={holding.id} holding={holding} netWorth={data.netWorth} />)}
                </div>
              </div>
            );
          })}
          <Link href="/onboarding?mode=edit" className="inline-flex text-xs font-semibold text-primary hover:underline">Edit holdings in profile →</Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HoldingRow({ holding, netWorth }: { holding: PortfolioHolding; netWorth: number }) {
  const pct = netWorth > 0 ? (holding.value / netWorth) * 100 : 0;
  const isFromAction = holding.source === "action";
  const hasCost = (holding.valueAtCost || 0) > 0;
  const plr = hasCost ? holding.value - (holding.valueAtCost || 0) : 0;
  const plp = hasCost && holding.valueAtCost! > 0 ? (plr / holding.valueAtCost!) * 100 : 0;
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-3">
        <InvestmentLogo name={holding.name} category={holding.category} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="line-clamp-1 text-sm font-semibold text-foreground">{holding.name}</p>
            {isFromAction ? <Badge tone="primary" className="text-[11px]">From your plan</Badge> : null}
          </div>
          <p className="text-[13px] text-muted-foreground">
            {holding.category}
            {isFromAction && holding.monthlyContribution ? ` · ${inr(holding.monthlyContribution)}/mo` : ""}
            {isFromAction && holding.since ? ` · since ${formatDate(holding.since)}` : ""}
            {hasCost ? ` · cost ${inr(holding.valueAtCost || 0)}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">{inr(holding.value)}</p>
          {hasCost ? (
            <p className={cn("text-xs font-medium", plr >= 0 ? "text-positive-foreground" : "text-negative-foreground")}>
              {plr >= 0 ? "+" : ""}{inr(plr)} ({plp >= 0 ? "+" : ""}{plp.toFixed(1)}%)
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground">{pct.toFixed(1)}%</p>
          )}
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
        <div className={cn("h-full rounded-full transition-all", isFromAction ? "bg-positive" : "bg-primary")} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function Pill({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof CheckCircle2; tone: "positive" | "info" | "neutral" }) {
  const toneClasses = {
    positive: "bg-positive-soft text-positive-foreground",
    info: "bg-info-soft text-info-foreground",
    neutral: "bg-surface text-foreground",
  };
  return (
    <div className="rounded-xl bg-surface-soft p-3">
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${toneClasses[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-[13px] text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1.5 text-lg font-bold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

// Edit investments straight from the net-worth card — reuses the onboarding
// "PortfolioBuckets" UI on a react-hook-form seeded from the live profile, then
// persists to the store + backend (partial save) so every tab stays in sync.
function EditInvestmentsDialog({ onSaved }: { onSaved: () => void }) {
  const profile = useAuthStore((state) => state.profile);
  const saveProfile = useAuthStore((state) => state.saveProfile);
  const token = useAuthStore((state) => state.token);
  const onboardingComplete = useAuthStore((state) => state.onboardingComplete);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useForm<OnboardingProfile>({ defaultValues: profile || undefined });
  const values = form.watch();

  useEffect(() => {
    if (open && profile) form.reset(profile);
  }, [open, profile, form]);

  if (!profile) return null;

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const next = { ...profile, ...form.getValues() };
    saveProfile(next, onboardingComplete);
    try {
      await api.saveOnboarding(next, token, { partial: true });
    } catch {
      /* local update applied; ignore network error */
    }
    setSaving(false);
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Edit your investments" title="Edit your investments" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground shadow-sm transition hover:border-primary hover:bg-surface-hover hover:text-primary">
          <Pencil className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[min(720px,95vw)] overflow-y-auto">
        <DialogTitle className="text-lg font-semibold text-foreground">Update your investments</DialogTitle>
        <DialogDescription className="mt-0.5 text-[13px] text-muted-foreground">
          Add, edit or remove holdings — the same buckets as onboarding. Changes save to your profile and sync across every tab.
        </DialogDescription>
        <div className="mt-4">
          <PortfolioBuckets form={form} values={values} />
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InsightTile({ insight }: { insight: PortfolioSummary["insights"][number] }) {
  const dot = insight.tone === "warning" ? "bg-warning" : insight.tone === "positive" ? "bg-positive" : "bg-info";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dot)} />
          <p className="text-[15px] font-bold tracking-tight text-foreground">{insight.title}</p>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{insight.body}</p>
      </CardContent>
    </Card>
  );
}

function PortfolioSidebarWidget({ startedActions, committed }: { startedActions: number; committed: number }) {
  return (
    <div className="rounded-2xl border border-positive-soft bg-positive-soft/60 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-positive-soft">
          <TrendingUp className="h-4 w-4 text-positive-foreground" />
        </span>
        <p className="text-sm font-semibold text-foreground">Portfolio momentum</p>
      </div>
      {startedActions > 0 ? (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{startedActions} active commitment{startedActions === 1 ? "" : "s"} · {inr(committed)}/mo flowing into your plan.</p>
      ) : (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Take action on a plan item to see your portfolio start building here.</p>
      )}
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
