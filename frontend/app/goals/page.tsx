"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUp, CalendarClock, CircleAlert, Link2, Pencil, Plus, ShieldCheck, Target, TimerReset } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ColorfulIcon } from "@/components/colorful-icon";
import { GoalEditDialog } from "@/components/goal-edit-dialog";
import { InvestmentLogo } from "@/components/investment-logo";
import { LinkHoldingsDialog } from "@/components/link-holdings-dialog";
import { TakeActionDialog } from "@/components/take-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { goalIconSpec } from "@/lib/icon-maps";
import { availableToInvest, emptyDashboard } from "@/lib/profile";
import { ActionItem, buildPlan, mergeIntoActionItems } from "@/lib/plan";
import { cn, inr } from "@/lib/utils";
import { useEnsureProfile } from "@/lib/use-ensure-profile";
import { useAuthStore } from "@/store/auth-store";
import { usePlanActionsStore } from "@/store/plan-actions-store";
import { AdvancedRecommendation, AssetIntelligence, DashboardData, PortfolioHolding, PortfolioSummary, ProfileGoal } from "@/types";

export default function GoalsPage() {
  // Recover the profile from the backend if the store is empty (deep load /
  // pre-rehydration), so goals + funding figures match the other tabs.
  const profile = useEnsureProfile();
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [rawRecs, setRawRecs] = useState<AdvancedRecommendation[]>([]);
  const [assets, setAssets] = useState<AssetIntelligence[]>([]);

  useEffect(() => {
    if (profile) {
      api.dashboard(profile).then(setData);
      api.portfolioSummary(profile).then(setPortfolio).catch(() => setPortfolio(null));
      // Pull the same plan recommendations so each goal's "Save more" fix can
      // offer the user's goal-linked picks to act on (amount pre-filled).
      api.generateAdvancedRecommendations(profile, false).then((res) => setRawRecs(res.recommendations || [])).catch(() => setRawRecs([]));
      // Real fund universe — used to offer genuine moderate-risk picks (with
      // their own return estimate) for the "Accept moderate risk" fix.
      api.assetIntelligence().then(setAssets).catch(() => setAssets([]));
    }
  }, [profile]);

  const holdings = portfolio?.holdings ?? [];
  const actionsTaken = usePlanActionsStore((state) => state.actionsTaken);
  const recItems = useMemo(() => mergeIntoActionItems(rawRecs, data), [rawRecs, data]);
  // The exact list the money plan is showing right now (top-3 pending + completed),
  // so each goal's "Save more" fix only offers items that are actually in the plan.
  const takenKeys = useMemo(() => new Set(actionsTaken.map((a) => a.key)), [actionsTaken]);
  const committedMonthly = useMemo(() => actionsTaken.filter((a) => a.cadence !== "one_time").reduce((s, a) => s + (a.amount || 0), 0), [actionsTaken]);
  const available = availableToInvest(profile, data.summary.monthlyIncome, committedMonthly);
  const planVisible = useMemo(() => buildPlan(recItems, takenKeys, available, true)["Must Do"], [recItems, takenKeys, available]);
  // Genuine moderate-risk funds (real name + real return), for the "Accept
  // moderate risk" fix — no fabricated instruments.
  const moderateFunds = useMemo<ModerateFund[]>(
    () => assets
      .map((a) => ({
        key: `asset-${a.assetName}-${a.ticker}`,
        name: a.assetName,
        category: a.normalizedAssetClass || a.assetType || a.category || "Fund",
        ticker: a.ticker || "",
        risk: normRisk(a.risk?.riskCategory || a.assetType || ""),
        expectedReturn: returnString(a.expectedReturn),
      }))
      .filter((o) => o.risk === "Medium" && Boolean(o.expectedReturn))
      .slice(0, 4),
    [assets],
  );

  // Build a quick index from goal display name → original ProfileGoal so we can edit
  function findProfileGoal(dashboardGoalName: string): { goal: ProfileGoal; index: number } | null {
    if (!profile?.goals?.length) return null;
    const target = dashboardGoalName.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const match = profile.goals.findIndex((g) => {
      const name = (g.type === "Other" ? g.customName : g.type) || "";
      return name.toLowerCase().replace(/[^a-z0-9]+/g, "") === target
        || name.toLowerCase().includes(dashboardGoalName.toLowerCase())
        || dashboardGoalName.toLowerCase().includes(name.toLowerCase());
    });
    if (match === -1) return null;
    return { goal: profile.goals[match], index: match };
  }

  return (
    <AppShell>
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">Your goals 🎯</h1>
          <p className="mt-2 text-base text-muted-foreground">Each goal, where it stands, and exactly what it takes to get there.</p>
        </div>
        <GoalEditDialog
          mode={{ kind: "add" }}
          trigger={<Button className="rounded-full px-5"><Plus className="h-4 w-4" /> Add Goal</Button>}
        />
      </div>

      <div className="space-y-5">
        {data.goals.map((goal) => {
          const match = findProfileGoal(goal.name);
          return <GoalCard key={goal.id} goal={goal} profileGoal={match} holdings={holdings} planItems={planVisible} moderateFunds={moderateFunds} />;
        })}
      </div>

      {!profile ? <EmptyState text="Complete onboarding to calculate goals from your real profile." href="/onboarding" cta="Complete Profile" useDialog={false} /> : null}
      {profile && !data.goals.length ? <EmptyState text="Add your first goal so the app can build a monthly plan around what matters to you." cta="Add Goal" useDialog={true} /> : null}

      {data.goals.length ? (
        <div className="mt-6 flex items-center justify-center">
          <GoalEditDialog
            mode={{ kind: "add" }}
            trigger={
              <button className="inline-flex items-center gap-2 rounded-full border border-dashed border-border bg-surface px-5 py-3 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                <Plus className="h-4 w-4" /> Add more goals to secure your future
              </button>
            }
          />
        </div>
      ) : null}
    </AppShell>
  );
}

function GoalCard({ goal, profileGoal, holdings, planItems, moderateFunds }: { goal: DashboardData["goals"][number]; profileGoal: { goal: ProfileGoal; index: number } | null; holdings: PortfolioHolding[]; planItems: ActionItem[]; moderateFunds: ModerateFund[] }) {
  const linkedIds = profileGoal?.goal.linkedHoldingIds || [];
  const linkedHoldings = useMemo(
    () => holdings.filter((h) => linkedIds.includes(h.id)),
    [holdings, linkedIds],
  );
  const linkedValue = linkedHoldings.reduce((sum, h) => sum + h.value, 0);
  const linkedMonthly = linkedHoldings.reduce((sum, h) => sum + (h.source === "action" ? (h.monthlyContribution || 0) : 0), 0);

  // Linked-holding funding is credited into goal.currentProgress by the backend
  // (single source of truth), so read it directly — no separate frontend blend.
  const progress = goal.targetAmount ? Math.min(goal.currentProgress / goal.targetAmount * 100, 100) : 0;
  const remaining = Math.max(goal.targetAmount - goal.currentProgress, 0);
  const onTrack = goal.feasibilityScore >= 70 || (goal.targetAmount > 0 && goal.currentProgress / goal.targetAmount >= 0.85);
  const icon = goalIconSpec(goal.name);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <ColorfulIcon icon={icon.icon} accent={icon.accent} label={icon.label} size="md" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">{goal.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={onTrack ? "good" : "danger"}>{onTrack ? "On track" : "Off track"}</Badge>
            {profileGoal ? (
              <GoalEditDialog
                mode={{ kind: "edit", index: profileGoal.index, goal: profileGoal.goal }}
                trigger={
                  <button aria-label="Edit goal" title="Edit goal" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground shadow-sm transition hover:border-primary hover:bg-surface-hover hover:text-primary">
                    <Pencil className="h-4 w-4" />
                  </button>
                }
              />
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-y-5 md:grid-cols-4">
          <Stat label="Target" value={inr(goal.targetAmount)} />
          <Stat label="Current" value={inr(goal.currentProgress)} />
          <Stat label="Remaining" value={inr(remaining)} />
          <Stat label="Time Left" value={goal.timelineProjection || "Update date"} />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Progress value={progress} className={onTrack ? "flex-1" : "flex-1 [&_>_div]:bg-negative"} />
          <span className="text-sm font-semibold text-foreground">{Math.round(progress)}%</span>
        </div>

        {profileGoal ? (
          <LinkedHoldingsRow
            profileGoal={profileGoal}
            holdings={holdings}
            linkedHoldings={linkedHoldings}
            linkedValue={linkedValue}
            linkedMonthly={linkedMonthly}
          />
        ) : null}

        <div className={`mt-5 flex flex-col gap-3 rounded-xl px-4 py-3.5 md:flex-row md:items-center md:justify-between ${onTrack ? "bg-positive-soft/60" : "bg-negative-soft/60"}`}>
          <div className="flex items-start gap-2.5">
            {onTrack ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-positive-foreground" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-negative-foreground" />}
            <div>
              <p className={`text-sm font-bold ${onTrack ? "text-positive-foreground" : "text-negative-foreground"}`}>Reality check</p>
              <p className="mt-0.5 text-sm leading-relaxed text-foreground">{onTrack ? "You're on track to achieve this goal." : "At your current pace, the goal will be missed."}</p>
            </div>
          </div>
          <div className="shrink-0 md:text-right">
            <p className="ap-eyebrow">Need / month</p>
            <p className={`text-xl font-extrabold tracking-tight tnum ${onTrack ? "text-positive-foreground" : "text-negative-foreground"}`}>{inr(goal.requiredMonthlyInvestment)}</p>
          </div>
        </div>

        {!onTrack ? <PickAFix goal={goal} profileGoal={profileGoal} planItems={planItems} moderateFunds={moderateFunds} /> : null}
      </CardContent>
    </Card>
  );
}

function LinkedHoldingsRow({
  profileGoal,
  holdings,
  linkedHoldings,
  linkedValue,
  linkedMonthly,
}: {
  profileGoal: { goal: ProfileGoal; index: number };
  holdings: PortfolioHolding[];
  linkedHoldings: PortfolioHolding[];
  linkedValue: number;
  linkedMonthly: number;
}) {
  const hasLinks = linkedHoldings.length > 0;
  return (
    <div className="mt-5 rounded-xl border border-border bg-surface-soft p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Linked holdings</p>
            {hasLinks ? <Badge tone="primary">{linkedHoldings.length}</Badge> : null}
          </div>
          {hasLinks ? (
            <p className="mt-1 text-[13px] text-muted-foreground">
              Tracking {inr(linkedValue)}
              {linkedMonthly > 0 ? ` · ${inr(linkedMonthly)}/mo flowing in` : ""}
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-muted-foreground">
              Connect investments from your portfolio so this goal updates automatically.
            </p>
          )}
        </div>
        <LinkHoldingsDialog
          mode={{ index: profileGoal.index, goal: profileGoal.goal }}
          holdings={holdings}
          trigger={
            <Button size="sm" variant={hasLinks ? "outline" : "default"} className="shrink-0">
              <Link2 className="h-3.5 w-3.5" /> {hasLinks ? "Manage links" : "Link holdings"}
            </Button>
          }
        />
      </div>
      {hasLinks ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {linkedHoldings.map((holding) => (
            <span key={holding.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
              <InvestmentLogo name={holding.name} category={holding.category} size="sm" className="!h-5 !w-5 !rounded-md" />
              <span className="max-w-[140px] truncate text-foreground">{holding.name}</span>
              <span className="text-muted-foreground">{inr(holding.value)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="ap-eyebrow">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight text-foreground tnum">{value}</p>
    </div>
  );
}

// "Pick a fix — see what happens": three concrete ways to rescue an off-track
// goal. The recommended one is highlighted; clicking any reveals the actual
// action (start an SIP / take a moderate-risk fund / push the deadline) so the
// user can act on it right there.
function PickAFix({ goal, profileGoal, planItems, moderateFunds }: { goal: DashboardData["goals"][number]; profileGoal: { goal: ProfileGoal; index: number } | null; planItems: ActionItem[]; moderateFunds: ModerateFund[] }) {
  const profile = useAuthStore((state) => state.profile);
  const saveProfile = useAuthStore((state) => state.saveProfile);
  const token = useAuthStore((state) => state.token);
  const onboardingComplete = useAuthStore((state) => state.onboardingComplete);
  const actionsTaken = usePlanActionsStore((state) => state.actionsTaken);
  const [selected, setSelected] = useState<"save" | "extend" | "risk" | null>(null);
  const [extended, setExtended] = useState(false);

  const saveMore = Math.max(Math.round((goal.requiredMonthlyInvestment || 0) / 500) * 500, 500);
  // Plan picks (pending or already-started) that fund THIS goal — the user picks
  // one and acts with the "save more" amount pre-filled.
  const goalKey = normKey(goal.name);
  // Only what the money plan is currently showing for THIS goal (pending or
  // already-started) — not every recommendation in the catalogue.
  const linkedOptions = useMemo(
    () => planItems
      .filter((it) => it.goalName && normKey(it.goalName) === goalKey)
      .map((it) => ({ key: it.key, name: it.title, category: it.category, ticker: it.ticker, expectedReturn: it.expectedReturn, risk: it.risk, completed: actionsTaken.some((a) => a.key === it.key) })),
    [planItems, actionsTaken, goalKey],
  );
  const extendMonths = goal.feasibilityScore >= 45 ? 4 : 8;
  const newTargetDate = useMemo(() => {
    const base = profileGoal?.goal.targetDate ? new Date(profileGoal.goal.targetDate) : new Date();
    if (Number.isNaN(base.getTime())) return null;
    base.setMonth(base.getMonth() + extendMonths);
    return base;
  }, [profileGoal, extendMonths]);

  const fixes = [
    { key: "save" as const, rec: true, icon: ArrowUp, label: `Save ${inr(saveMore)}/mo more`, outcome: `Gets ${goal.name} back on track to finish on time.` },
    { key: "extend" as const, rec: false, icon: CalendarClock, label: `Extend by ${extendMonths} months`, outcome: "Keep your current pace and finish a little later." },
    { key: "risk" as const, rec: false, icon: TimerReset, label: "Accept moderate risk", outcome: "~10–12% returns could get you there sooner." },
  ];

  function applyExtend() {
    if (!profile || !profileGoal || !newTargetDate) return;
    const goals = [...(profile.goals || [])];
    goals[profileGoal.index] = { ...profileGoal.goal, targetDate: newTargetDate.toISOString().slice(0, 10) };
    const next = { ...profile, goals };
    saveProfile(next, onboardingComplete); // re-fetches the dashboard via the profile dep
    api.saveOnboarding(next, token, { partial: true }).catch(() => null);
    setExtended(true);
  }

  const savePayload = {
    key: `goal-fix-save-${goal.id}`,
    instrumentName: `Extra SIP for ${goal.name}`,
    category: goal.name,
    ticker: "",
    suggestedMonthlyAmount: saveMore,
    actionLabel: "Start SIP",
    reason: `Adds ${inr(saveMore)}/mo so ${goal.name} reaches its target on time.`,
    kind: "fund" as const,
    goalName: goal.name,
  };

  return (
    <div className="mt-5">
      <p className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Pick a fix — see what happens</p>
      <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
        {fixes.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setSelected(f.key)}
            aria-pressed={selected === f.key}
            className={cn(
              "relative rounded-2xl border p-4 text-left transition",
              f.rec ? "border-primary bg-positive-soft/40" : "border-border bg-surface hover:border-primary/50",
              selected === f.key && "ring-2 ring-primary/40",
            )}
          >
            {f.rec ? (
              <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary-foreground">Recommended</span>
            ) : null}
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", f.rec ? "bg-positive-soft text-positive-foreground" : "bg-surface-soft text-muted-foreground")}>
              <f.icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-bold text-foreground">{f.label}</p>
            <p className={cn("mt-1 text-[13px] leading-snug", f.rec ? "text-positive-foreground" : "text-muted-foreground")}>{f.outcome}</p>
          </button>
        ))}
      </div>

      {selected === "save" ? (
        <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <p className="text-sm font-bold text-foreground">Put {inr(saveMore)}/mo toward {goal.name}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {linkedOptions.length ? "Pick one of your plan picks linked to this goal — the amount is pre-filled when you take action." : "Start a fresh contribution toward this goal."}
          </p>
          <div className="mt-3 space-y-2">
            {linkedOptions.length ? linkedOptions.map((opt) => (
              <div key={opt.key} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5">
                <InvestmentLogo name={opt.name} category={opt.category} ticker={opt.ticker} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">{opt.name}</p>
                  <p className="text-[12px] text-muted-foreground">{opt.category}{opt.completed ? " · already started" : ""}</p>
                </div>
                <TakeActionDialog
                  payload={{ key: opt.key, instrumentName: opt.name, category: opt.category, ticker: opt.ticker, suggestedMonthlyAmount: saveMore, actionLabel: opt.completed ? "Top up" : "Start SIP", expectedReturn: opt.expectedReturn, risk: opt.risk, kind: "fund" as const, goalName: goal.name }}
                  trigger={<Button size="sm" variant={opt.completed ? "outline" : "default"} className="shrink-0">{opt.completed ? "Top up" : "Take action"}</Button>}
                />
              </div>
            )) : (
              <TakeActionDialog payload={savePayload} trigger={<Button className="w-full sm:w-auto">Start a contribution</Button>} />
            )}
          </div>
        </div>
      ) : null}

      {selected === "risk" ? (
        <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <p className="text-sm font-bold text-foreground">Grow {goal.name} with a moderate-risk fund</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {moderateFunds.length ? "Real moderate-risk funds, each with its own return estimate — the amount is pre-filled when you take action." : "No moderate-risk funds available right now."}
          </p>
          <div className="mt-3 space-y-2">
            {moderateFunds.length ? moderateFunds.map((opt) => (
              <div key={opt.key} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5">
                <InvestmentLogo name={opt.name} category={opt.category} ticker={opt.ticker} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">{opt.name}</p>
                  <p className="text-[12px] text-muted-foreground">{opt.category}{opt.expectedReturn ? ` · ~${opt.expectedReturn}` : ""}</p>
                </div>
                <TakeActionDialog
                  payload={{ key: opt.key, instrumentName: opt.name, category: opt.category, ticker: opt.ticker, suggestedMonthlyAmount: saveMore, actionLabel: "Start SIP", expectedReturn: opt.expectedReturn, risk: "Medium", kind: "fund" as const, goalName: goal.name }}
                  trigger={<Button size="sm" className="shrink-0">Take action</Button>}
                />
              </div>
            )) : (
              <Link href="/asset-intelligence" className="inline-flex text-sm font-semibold text-primary hover:underline">Browse moderate-risk options in Discover →</Link>
            )}
          </div>
        </div>
      ) : null}

      {selected === "extend" ? (
        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {!profileGoal ? (
              <p className="text-sm text-muted-foreground">Add this goal to your profile to adjust its timeline.</p>
            ) : extended ? (
              <p className="text-sm font-bold text-positive-foreground">Timeline extended to {newTargetDate ? formatMonthYear(newTargetDate) : "a later date"} — your monthly need will drop.</p>
            ) : (
              <>
                <p className="text-sm font-bold text-foreground">Push the target to {newTargetDate ? formatMonthYear(newTargetDate) : "later"}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Keeps your current saving pace — the required monthly drops as the deadline moves out.</p>
              </>
            )}
          </div>
          {profileGoal && !extended ? <Button className="shrink-0" onClick={applyExtend}>Apply</Button> : null}
        </div>
      ) : null}
    </div>
  );
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function normKey(value: string) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

type ModerateFund = { key: string; name: string; category: string; ticker: string; risk: string; expectedReturn: string };

function normRisk(value: string) {
  const t = (value || "").toLowerCase();
  if (t.includes("low")) return "Low";
  if (t.includes("high") || t.includes("extreme") || t.includes("very")) return "High";
  return "Medium";
}

function returnString(er?: { label?: string; cagrRange?: string; expectedCagr?: number } | null): string {
  if (!er) return "";
  if (er.label) return er.label.replace(/CAGR/gi, "p.a.");
  if (er.cagrRange) return `${er.cagrRange} p.a.`;
  if (typeof er.expectedCagr === "number") return `${er.expectedCagr}% p.a.`;
  return "";
}

function EmptyState({ text, href, cta, useDialog }: { text: string; href?: string; cta: string; useDialog: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <ColorfulIcon icon={Target} accent="emerald" label="Goals" />
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
        {useDialog ? (
          <GoalEditDialog mode={{ kind: "add" }} trigger={<Button>{cta}</Button>} />
        ) : (
          <Button asChild><Link href={href || "/onboarding"}>{cta}</Link></Button>
        )}
      </CardContent>
    </Card>
  );
}

