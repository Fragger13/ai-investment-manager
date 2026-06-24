"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUp, CalendarClock, CircleAlert, Link2, Pencil, Plus, ShieldCheck, Target, TimerReset } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ColorfulIcon } from "@/components/colorful-icon";
import { GoalEditDialog } from "@/components/goal-edit-dialog";
import { InvestmentLogo } from "@/components/investment-logo";
import { LinkHoldingsDialog } from "@/components/link-holdings-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { goalIconSpec } from "@/lib/icon-maps";
import { emptyDashboard } from "@/lib/profile";
import { inr } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { DashboardData, PortfolioHolding, PortfolioSummary, ProfileGoal } from "@/types";

export default function GoalsPage() {
  const profile = useAuthStore((state) => state.profile);
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);

  useEffect(() => {
    if (profile) {
      api.dashboard(profile).then(setData);
      api.portfolioSummary(profile).then(setPortfolio).catch(() => setPortfolio(null));
    }
  }, [profile]);

  const holdings = portfolio?.holdings ?? [];

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
          return <GoalCard key={goal.id} goal={goal} profileGoal={match} holdings={holdings} />;
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

function GoalCard({ goal, profileGoal, holdings }: { goal: DashboardData["goals"][number]; profileGoal: { goal: ProfileGoal; index: number } | null; holdings: PortfolioHolding[] }) {
  const linkedIds = profileGoal?.goal.linkedHoldingIds || [];
  const linkedHoldings = useMemo(
    () => holdings.filter((h) => linkedIds.includes(h.id)),
    [holdings, linkedIds],
  );
  const linkedValue = linkedHoldings.reduce((sum, h) => sum + h.value, 0);
  const linkedMonthly = linkedHoldings.reduce((sum, h) => sum + (h.source === "action" ? (h.monthlyContribution || 0) : 0), 0);

  const effectiveCurrent = Math.max(goal.currentProgress, goal.currentProgress + linkedValue - (profileGoal?.goal.currentAmount || 0));
  const blendedCurrent = linkedHoldings.length > 0 ? effectiveCurrent : goal.currentProgress;
  const progress = goal.targetAmount ? Math.min(blendedCurrent / goal.targetAmount * 100, 100) : 0;
  const remaining = Math.max(goal.targetAmount - blendedCurrent, 0);
  const onTrack = goal.feasibilityScore >= 70 || (goal.targetAmount > 0 && blendedCurrent / goal.targetAmount >= 0.85);
  const icon = goalIconSpec(goal.name);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <ColorfulIcon icon={icon.icon} accent={icon.accent} label={icon.label} size="md" />
            <h2 className="text-xl font-semibold text-foreground">{goal.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={onTrack ? "good" : "danger"}>{onTrack ? "On Track" : "Off Track"}</Badge>
            {profileGoal ? (
              <GoalEditDialog
                mode={{ kind: "edit", index: profileGoal.index, goal: profileGoal.goal }}
                trigger={
                  <button aria-label="Edit goal" className="rounded-full p-1.5 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                }
              />
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-y-5 md:grid-cols-4">
          <Stat label="Target" value={inr(goal.targetAmount)} />
          <Stat label="Current" value={inr(blendedCurrent)} />
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

        <div className={`mt-5 flex flex-col gap-2 rounded-xl px-4 py-3 md:flex-row md:items-center md:justify-between ${onTrack ? "bg-positive-soft/60" : "bg-negative-soft/60"}`}>
          <div className="flex items-start gap-2.5">
            {onTrack ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive-foreground" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative-foreground" />}
            <div>
              <p className={`text-sm font-semibold ${onTrack ? "text-positive-foreground" : "text-negative-foreground"}`}>Reality Check</p>
              <p className="mt-0.5 text-sm text-foreground/80">{onTrack ? "You're on track to achieve this goal." : "At your current pace, the goal will be missed."}</p>
            </div>
          </div>
          <p className={`shrink-0 text-sm font-semibold ${onTrack ? "text-positive-foreground" : "text-negative-foreground"}`}>Need {inr(goal.requiredMonthlyInvestment)}/month</p>
        </div>

        {!onTrack ? (
          <>
            <p className="mt-5 text-sm font-semibold text-foreground">Fix Options</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <FixPill icon={ArrowUp} accent="green" title="Increase savings by" value={`${inr(Math.max(Math.round((goal.requiredMonthlyInvestment || 0) * 0.2 / 500) * 500, 500))}/month`} />
              <FixPill icon={CalendarClock} accent="violet" title="Extend timeline by" value={timelineFix(goal)} />
              <FixPill icon={TimerReset} accent="teal" title="Accept moderate" value="investment risk" />
            </div>
          </>
        ) : null}
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
            <p className="mt-1 text-xs text-muted-foreground">
              Tracking {inr(linkedValue)}
              {linkedMonthly > 0 ? ` · ${inr(linkedMonthly)}/mo flowing in` : ""}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
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
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function FixPill({ icon: Icon, accent, title, value }: { icon: typeof ArrowUp; accent: "green" | "violet" | "teal"; title: string; value: string }) {
  const accentClasses = {
    green: "bg-positive-soft text-positive-foreground",
    violet: "bg-[hsl(262_70%_94%)] text-[hsl(262_50%_38%)] dark:bg-[hsl(262_40%_18%)] dark:text-[hsl(262_70%_78%)]",
    teal: "bg-info-soft text-info-foreground",
  };
  return (
    <button className="group inline-flex items-center gap-2.5 rounded-full border border-border bg-surface py-2 pl-2 pr-4 text-left transition hover:border-primary hover:bg-surface-hover">
      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${accentClasses[accent]}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm text-foreground">
        {title} <span className="font-semibold">{value}</span>
      </span>
    </button>
  );
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

function timelineFix(goal: DashboardData["goals"][number]) {
  if (goal.feasibilityScore >= 70) return "not needed";
  if (goal.feasibilityScore >= 45) return "4 months";
  return "8 months";
}
