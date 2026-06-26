"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarRange, CheckCircle2, ChevronRight, CircleAlert, CreditCard, Home, Pencil, PiggyBank, Receipt, Repeat, Sprout, Sparkles, WalletCards } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AppShell } from "@/components/app-shell";
import { ColorfulIcon } from "@/components/colorful-icon";
import { InvestmentLogo } from "@/components/investment-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { PapaBubble, type PapaMood } from "@/app/onboarding/_components/papa-bubble";
import { availableToInvest, currentBudgetMonth, emptyDashboard, isOnboardingComplete, monthlyCommitments, profileCompletionPercent } from "@/lib/profile";
import { ActionItem, amountLabel, buildPlan, mergeIntoActionItems, purposeTag } from "@/lib/plan";
import { cn, inr, inrShort } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { usePlanActionsStore } from "@/store/plan-actions-store";
import { AdvancedRecommendation, DashboardData, OnboardingProfile } from "@/types";

export default function DashboardPage() {
  const profile = useAuthStore((state) => state.profile);
  const saveProfile = useAuthStore((state) => state.saveProfile);
  const token = useAuthStore((state) => state.token);
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [advRecs, setAdvRecs] = useState<AdvancedRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const actionsTaken = usePlanActionsStore((state) => state.actionsTaken);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let activeProfile: OnboardingProfile | null = profile;
      if (!activeProfile) {
        const latest = await api.latestProfile(token).catch(() => ({ profile: null }));
        activeProfile = latest.profile;
        if (activeProfile) saveProfile(activeProfile, isOnboardingComplete(activeProfile));
      }
      setData(activeProfile ? await api.dashboard(activeProfile) : emptyDashboard);
      setLoading(false);
      // Pull the same advanced recommendations the Plan page uses so the home
      // "next moves" stay in sync. Non-blocking: cached and fast, but never
      // holds up the rest of the dashboard.
      if (activeProfile) {
        api.generateAdvancedRecommendations(activeProfile, false)
          .then((res) => setAdvRecs(res.recommendations || []))
          .catch(() => setAdvRecs([]));
      }
    }
    load();
  }, [profile, saveProfile, token]);

  const needsProfile = !profile && !data.summary.monthlyIncome;
  // Total monthly outflow (rent + everyday expenses + EMIs) and what's left to
  // invest this month — shared helpers so the dashboard, Plan and Portfolio all
  // agree on the same "available this month" figure.
  const commitments = monthlyCommitments(profile);
  // Only recurring (SIP) commitments reduce what's available *each month*; a
  // one-time lump sum is paid once and doesn't shrink the monthly surplus.
  const committedMonthly = useMemo(
    () => actionsTaken.filter((a) => a.cadence !== "one_time").reduce((sum, a) => sum + (a.amount || 0), 0),
    [actionsTaken]
  );
  const available = availableToInvest(profile, data.summary.monthlyIncome, committedMonthly);
  const userHasGoals = (profile?.goals?.length || 0) > 0;
  const topGoals = userHasGoals ? data.goals.slice(0, 3) : [];
  // Same merge + ranking + budget calibration the Plan page runs, so the home
  // "next moves" are identical to the plan's "Do first" tab — same items AND the
  // same budget-sized amounts.
  const takenKeys = useMemo(() => new Set(actionsTaken.map((entry) => entry.key)), [actionsTaken]);
  // Use the SAME stable-membership plan the Plan page renders (keepTaken=true) so
  // the home "Do this first" preview matches it exactly: completing one item does
  // NOT pull a 4th into view. We show only the still-pending members here.
  const planMustDo = useMemo(
    () => buildPlan(mergeIntoActionItems(advRecs, data), takenKeys, available, true)["Must Do"],
    [advRecs, data, takenKeys, available]
  );
  const topActions = useMemo(() => planMustDo.filter((item) => !takenKeys.has(item.key)), [planMustDo, takenKeys]);
  const planDoneCount = useMemo(() => planMustDo.filter((item) => takenKeys.has(item.key)).length, [planMustDo, takenKeys]);
  const status = healthStatus(data.health.score);
  const insight = monthlyInsight(data, commitments);
  const completionPercent = profileCompletionPercent(profile);

  return (
    <AppShell sidebarExtra={completionPercent < 100 ? <ProfileCompletionCard percent={completionPercent} /> : null}>
      <section className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            {greeting(profile?.name)} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 text-base text-muted-foreground">{dashboardSubtitle(data.health.score)}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/onboarding?mode=edit"><Pencil className="h-4 w-4" /> Edit profile</Link>
        </Button>
      </section>

      {needsProfile ? (
        <Card className="mb-5 border-primary/25 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xl font-semibold text-foreground">Let&apos;s complete your financial profile.</p>
              <p className="mt-2 text-sm text-muted-foreground">Add your income, spending, goals, and investments so your home screen can guide you.</p>
            </div>
            <Button asChild><Link href="/onboarding">Complete profile <ArrowRight className="h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? <p className="mb-4 text-sm text-muted-foreground">Preparing your home screen...</p> : null}

      {!needsProfile ? (
        <div className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-[.82fr_1.18fr]">
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Available to invest this month</p>
                      <EditAvailableDialog />
                    </div>
                    <p className="mt-2 text-5xl font-extrabold tracking-tight text-positive-foreground md:text-6xl tnum">{inrShort(available)}</p>
                    <p className="mt-2 text-[15px] text-muted-foreground">Can be invested or saved.</p>
                  </div>
                  <MoneyJar className="-mt-1 hidden shrink-0 -translate-x-[1.5cm] sm:block" />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild className="rounded-full"><Link href="/chat">What should I do with it? <Sparkles className="h-4 w-4" /></Link></Button>
                  <Button variant="outline" asChild className="rounded-full"><Link href="/recommendations">View my plan <ArrowRight className="h-4 w-4" /></Link></Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="grid gap-6 p-7 lg:grid-cols-[.85fr_1fr] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="ap-eyebrow">Financial health</p>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-5xl font-extrabold leading-none tracking-tight text-foreground tnum">{data.health.score}</span>
                    <span className="pb-1.5 text-lg font-semibold text-muted-foreground">/ 100</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {healthBullets(data, commitments).map((item) => (
                      <div key={item.text} className="flex items-center gap-2 text-sm font-medium text-foreground">
                        {item.good ? <CheckCircle2 className="h-4 w-4 text-positive-foreground" /> : <CircleAlert className="h-4 w-4 text-warning-foreground" />}
                        {item.text}
                      </div>
                    ))}
                  </div>
                </div>
                <PapaBubble
                  message={papaComment(data.health.score)}
                  mood={papaMood(data.health.score)}
                  size="md"
                  className="-ml-[1.3cm]"
                  textClassName="text-[26px] sm:text-[30px]"
                />
              </CardContent>
            </Card>
          </div>

          <section>
            <h2 className="ap-section mb-3">Money snapshot</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <SnapshotCard icon={WalletCards} accent="emerald" label="Monthly income" value={inrShort(data.summary.monthlyIncome)} detail="Coming in monthly" />
              <CommitmentsCard total={commitments} profile={profile} />
              <NetWorthCard value={inrShort(data.summary.netWorth)} />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Your goals</CardTitle>
                <Link href="/goals" className="text-sm font-bold text-primary hover:underline">View all goals <ArrowRight className="inline h-4 w-4" /></Link>
              </CardHeader>
              <CardContent className="space-y-5">
                {topGoals.map((goal) => <GoalPreview key={goal.id} goal={goal} />)}
                {!topGoals.length ? (
                  <div className="rounded-xl border border-dashed border-border bg-surface-soft p-5 text-center">
                    <p className="text-sm font-medium text-foreground">You haven&apos;t added any goals yet.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Add your first goal to see whether you are on track.</p>
                    <Button asChild size="sm" className="mt-3 rounded-full">
                      <Link href="/onboarding?mode=goals&add=1">Add a goal <ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                  </div>
                ) : null}
                {topGoals.length ? <DashboardNudge tone="green" emoji="🎯">Keep going! Small steps today, big freedom tomorrow.</DashboardNudge> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Do this first</CardTitle>
                <Link href="/recommendations" className="text-sm font-bold text-primary hover:underline">Full plan <ArrowRight className="inline h-4 w-4" /></Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {topActions.map((action) => <DashboardActionRow key={action.key} action={action} />)}
                {!topActions.length ? (
                  planDoneCount > 0
                    ? <p className="text-sm text-muted-foreground">All your top steps are done — nice work! 🎉 Open the full plan for what&apos;s next.</p>
                    : <p className="text-sm text-muted-foreground">Refresh your plan after completing your profile to see your next steps.</p>
                ) : null}
                {topActions.length ? <DashboardNudge tone="sun" emoji="💡">Start with these and you&apos;ll see the biggest impact.</DashboardNudge> : null}
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <ColorfulIcon icon={Sparkles} accent="emerald" label="Insight for you" />
                <div>
                  <p className="font-bold text-foreground">Insight for you</p>
                  <p className="mt-1 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">{insight}</p>
                </div>
              </div>
              <Button variant="outline" asChild><Link href="/chat">Explore how <ArrowRight className="h-4 w-4" /></Link></Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}

function SnapshotCard({ icon, accent, label, value, detail, highlight }: { icon: typeof WalletCards; accent: "emerald" | "violet" | "blue"; label: string; value: string; detail: string; highlight?: boolean }) {
  return (
    <Card className={cn(highlight && "border-2 border-primary/35 bg-primary/[0.06] shadow-pop")}>
      <CardContent className="flex items-center gap-5 p-5">
        <ColorfulIcon icon={icon} accent={accent} label={label} size="lg" />
        <div>
          <p className="ap-label flex items-center gap-1.5">
            {label}
            {highlight ? <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Total</span> : null}
          </p>
          <p className={cn("mt-1 text-2xl font-bold tracking-tight tnum", highlight ? "text-primary" : "text-foreground")}>{value}</p>
          <p className="ap-help mt-1">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardActionRow({ action }: { action: ActionItem }) {
  return (
    <Link href="/recommendations" className="flex items-center gap-4 rounded-2xl border border-border bg-surface-soft p-4 transition hover:bg-surface-hover">
      <InvestmentLogo name={action.title} extraHint={action.instrumentName} category={action.category} ticker={action.ticker} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 block text-[15px] font-bold text-foreground">{action.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px]">
          <span className="font-bold text-primary tnum">{amountLabel(action)}</span>
          <span className="text-muted-foreground">· 🎯 {purposeTag(action)}</span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function MoneyJar({ className }: { className?: string }) {
  return (
    <Image
      src="/money-jar.png"
      alt="Savings jar with coins and a sprout"
      width={220}
      height={417}
      className={cn("h-[8.4rem] w-auto select-none", className)}
      priority
    />
  );
}

function EditAvailableDialog() {
  const profile = useAuthStore((state) => state.profile);
  const saveProfile = useAuthStore((state) => state.saveProfile);
  const onboardingComplete = useAuthStore((state) => state.onboardingComplete);
  const token = useAuthStore((state) => state.token);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setAmount(availableToInvest(profile));
  }, [open, profile]);

  if (!profile) return null;

  async function save() {
    if (!profile) return;
    setSaving(true);
    const next = { ...profile, investableThisMonth: Math.max(0, Math.round(amount)), investableThisMonthMonth: currentBudgetMonth() };
    saveProfile(next, onboardingComplete);
    try {
      await api.saveOnboarding(next, token, { partial: true });
    } catch {
      /* local update already applied; ignore network error */
    }
    setSaving(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Edit available this month" className="rounded-full p-1 text-muted-foreground transition hover:bg-surface-hover hover:text-primary">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="w-[min(440px,94vw)] p-0">
        <div className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-lg font-semibold text-foreground">Available to invest this month</DialogTitle>
          <DialogDescription className="mt-0.5 text-[13px] text-muted-foreground">Set what you can actually invest this month — your plan resizes to fit it.</DialogDescription>
        </div>
        <div className="p-6">
          <label htmlFor="edit-available" className="text-sm font-semibold text-foreground">Amount this month</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border-2 border-input bg-surface px-3">
            <span className="text-base font-semibold text-muted-foreground">₹</span>
            <Input
              id="edit-available"
              type="number"
              min={0}
              value={amount || ""}
              onChange={(event) => setAmount(Number(event.target.value || 0))}
              className="border-0 px-0 text-lg focus-visible:ring-0"
              autoFocus
            />
            <span className="text-xs text-muted-foreground">/ month</span>
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">This is your income left after rent, EMIs and expenses. Even ₹500 counts — start where you are.</p>
          <div className="mt-5 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={save} disabled={saving || amount <= 0}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NetWorthCard({ value }: { value: string }) {
  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(157_82%_32%)] via-[hsl(162_74%_34%)] to-[hsl(170_70%_36%)] p-5 text-white shadow-pop">
      <div aria-hidden className="pointer-events-none absolute -right-7 -top-9 h-28 w-28 rounded-full bg-white/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-10 right-6 h-24 w-24 rounded-full bg-white/[0.07]" />
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
        <PiggyBank className="h-6 w-6 text-white" />
      </span>
      <div className="relative min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
          Net worth
          <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Total</span>
        </p>
        <p className="mt-1 truncate text-3xl font-extrabold tracking-tight text-white tnum">{value}</p>
        <p className="mt-0.5 text-sm font-medium text-white/90">Everything you own today</p>
      </div>
    </div>
  );
}

function DashboardNudge({ tone, emoji, children }: { tone: "green" | "sun"; emoji: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border p-3.5", tone === "green" ? "border-positive/20 bg-positive-soft" : "border-sun/30 bg-sun-soft")}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm" aria-hidden>{emoji}</span>
      <p className="text-sm font-medium text-foreground">{children}</p>
    </div>
  );
}

function GoalPreview({ goal }: { goal: DashboardData["goals"][number] }) {
  const progress = goal.targetAmount ? Math.min(goal.currentProgress / goal.targetAmount * 100, 100) : 0;
  const onTrack = goal.feasibilityScore >= 70;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{goal.name}</p>
          <p className="text-sm text-muted-foreground">{inrShort(goal.currentProgress)} / {inrShort(goal.targetAmount)}</p>
        </div>
        <Badge tone={onTrack ? "good" : "danger"}>{onTrack ? "On Track" : "Off Track"}</Badge>
      </div>
      <div className="flex items-center gap-3">
        <Progress value={progress} className="flex-1" />
        <span className="text-sm font-medium text-foreground">{Math.round(progress)}%</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{onTrack ? "On track to achieve this goal." : `Need ${inrShort(goal.requiredMonthlyInvestment)}/month.`}</p>
    </div>
  );
}

function greeting(name?: string) {
  const hour = new Date().getHours();
  const prefix = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = name?.trim().split(/\s+/)[0] || "";
  return `${prefix}${firstName ? `, ${firstName} Beta` : ", Beta"}`;
}

function dashboardSubtitle(score: number) {
  if (score >= 85) return "Your money habits look solid. Keep at it.";
  if (score >= 70) return "Steady progress. A few small wins go a long way.";
  if (score >= 40) return "Some areas need work. Papa has a plan.";
  return "Let's tighten up the basics first. We've got this.";
}

function papaComment(score: number) {
  if (score >= 85) return "Wah beta. So you do listen sometimes. Don't let it go to your head.";
  if (score >= 70) return "Not bad. Now don't celebrate like you won the IPL.";
  if (score >= 40) return "Could be worse. Could also be much, much better. Your call.";
  return "Beta, your bank account is sending me distress signals.";
}

function papaMood(score: number): PapaMood {
  if (score >= 85) return "proud";
  if (score >= 70) return "blessed";
  if (score >= 40) return "gentle";
  return "concerned";
}

function healthStatus(score: number): { label: string; tone: "good" | "warn" | "danger" | "neutral" } {
  if (score >= 85) return { label: "Excellent", tone: "good" };
  if (score >= 70) return { label: "Good", tone: "good" };
  if (score >= 40) return { label: "Getting Better", tone: "warn" };
  return { label: "Needs Work", tone: "danger" };
}

function healthBullets(data: DashboardData, commitments: number) {
  const income = Math.max(data.summary.monthlyIncome, 1);
  return [
    { good: data.health.emergencyFundMonths >= 3, text: data.health.emergencyFundMonths >= 3 ? "Emergency fund looks reasonable." : "Emergency fund needs work." },
    { good: data.summary.investableSurplus > 0, text: data.summary.investableSurplus > 0 ? "Investments can stay on track." : "Savings room is tight right now." },
    { good: commitments / income <= 0.35, text: commitments / income <= 0.35 ? "Debt and commitments are manageable." : "Monthly commitments are taking up too much income." },
  ];
}

function monthlyInsight(data: DashboardData, commitments: number) {
  if (commitments > data.summary.monthlyIncome * 0.35) {
    return `You spend ${inrShort(commitments)} on fixed commitments. Reducing this can quickly increase what you can save or invest.`;
  }
  if (data.health.emergencyFundMonths < 3) {
    return "Your emergency savings need attention. Building this first can make every other investment decision safer.";
  }
  return "Your monthly surplus looks useful. The next best step is to fund priority goals before adding higher-risk investments.";
}

function ProfileCompletionCard({ percent }: { percent: number }) {
  return (
    <Link
      href="/onboarding?mode=edit"
      className="block rounded-2xl bg-[#E9F4EC] p-4 transition hover:bg-[#DFF0E4]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
        <Sprout className="h-5 w-5 text-[#138A3C]" />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">Complete your profile</p>
      <p className="mt-1 text-xs text-muted-foreground">Get more personalized recommendations.</p>
      <p className="mt-3 text-xs font-medium text-foreground">{percent}% complete</p>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-[#138A3C] transition-all" style={{ width: `${percent}%` }} />
        </div>
        <ChevronRight className="h-3 w-3 text-foreground" />
      </div>
    </Link>
  );
}

function CommitmentsCard({ total, profile }: { total: number; profile: OnboardingProfile | null }) {
  const summary = useMemo(() => commitmentSummary(profile), [profile]);
  const canOpen = summary.items.length > 0;

  const trigger = (
    <button
      type="button"
      className="flex w-full items-center gap-5 text-left"
      disabled={!canOpen}
      aria-label="Open commitments breakdown"
    >
      <ColorfulIcon icon={CreditCard} accent="violet" label="Monthly Commitments" size="lg" />
      <div className="min-w-0 flex-1">
        <p className="ap-label">Monthly commitments</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tnum">{inrShort(total)}</p>
        <p className="ap-help mt-1">Rent, EMIs, monthly expenses</p>
      </div>
      {canOpen ? (
        <span className="shrink-0 text-muted-foreground">
          <ChevronRight className="h-4 w-4" />
        </span>
      ) : null}
    </button>
  );

  if (!canOpen) {
    return (
      <Card>
        <CardContent className="p-5">{trigger}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="transition hover:border-primary/40">
      <CardContent className="p-5">
        <Dialog>
          <DialogTrigger asChild>{trigger}</DialogTrigger>
          <DialogContent className="max-h-[90vh] w-[min(640px,94vw)] overflow-y-auto p-0">
            <div className="border-b border-border px-6 py-5 pr-12">
              <DialogTitle className="text-lg font-semibold text-foreground">Monthly commitments breakdown</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                A detailed look at the {inr(total)} leaving your account every month.
              </DialogDescription>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <CommitSummaryTile label="Rent" amount={summary.rent} icon={Home} />
                <CommitSummaryTile label="Loans / EMIs" amount={summary.totalEmi} icon={Repeat} />
                <CommitSummaryTile label="Monthly expenses" amount={summary.monthlyExpenses} icon={Receipt} />
              </div>

              {summary.loans.length ? (
                <div>
                  <p className="text-sm font-semibold text-foreground">Loans &amp; EMIs</p>
                  <ul className="mt-3 space-y-2">
                    {summary.loans.map((loan) => (
                      <li key={loan.id} className="rounded-xl border border-border bg-surface p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-sm font-semibold text-foreground">{loan.name}</p>
                            {loan.productType ? (
                              <p className="text-xs text-muted-foreground">{loan.productType}</p>
                            ) : null}
                          </div>
                          <p className="shrink-0 text-base font-semibold text-foreground">{inr(loan.monthlyEmi)}<span className="ml-1 text-xs font-normal text-muted-foreground">/mo</span></p>
                        </div>
                        {loan.window ? (
                          <dl className="mt-3 grid grid-cols-1 gap-3 text-xs">
                            <CommitFact label="Window" value={loan.window} icon={CalendarRange} />
                          </dl>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {summary.simpleRows.length ? (
                <div>
                  <p className="text-sm font-semibold text-foreground">Other recurring</p>
                  <ul className="mt-3 space-y-2">
                    {summary.simpleRows.map((row) => (
                      <li key={row.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-soft text-muted-foreground">
                          <row.icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 font-medium text-foreground">{row.name}</span>
                        <span className="shrink-0 font-semibold text-foreground">{inr(row.amount)}<span className="ml-1 text-xs font-normal text-muted-foreground">/mo</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {summary.legacyEmiOnly > 0 ? (
                <div className="rounded-xl border border-warning/30 bg-warning-soft/50 p-4 text-sm">
                  <p className="font-semibold text-warning-foreground">EMIs total {inr(summary.legacyEmiOnly)}/mo — not broken down yet</p>
                  <p className="mt-1 text-foreground">Your profile only has a consolidated EMI figure. Add each loan individually to see the per-loan principal, interest, rate and end date here.</p>
                  <Link href="/onboarding?mode=edit" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                    Add detailed loans <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function CommitSummaryTile({ label, amount, icon: Icon }: { label: string; amount: number; icon: typeof Home }) {
  return (
    <div className="rounded-xl bg-surface-soft p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-1.5 text-lg font-semibold text-foreground">{amount > 0 ? inr(amount) : "—"}</p>
    </div>
  );
}

function CommitFact({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Home }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-foreground">
        {Icon ? <Icon className="h-3 w-3 text-muted-foreground" /> : null}
        {value}
      </dd>
    </div>
  );
}

function commitmentSummary(profile: OnboardingProfile | null) {
  const empty = {
    rent: 0,
    totalEmi: 0,
    monthlyExpenses: 0,
    loans: [] as LoanRow[],
    simpleRows: [] as SimpleRow[],
    items: [] as SimpleRow[],
    legacyEmiOnly: 0,
  };
  if (!profile) return empty;

  // Permissive filter so any saved loan with meaningful info shows up. The
  // previous filter required monthlyEmi or principal > 0, which dropped loans
  // that only had a name + dates and forced the user into the consolidated
  // fallback. Now any loan with a name, rate, date, or amount renders.
  const loans: LoanRow[] = (profile.emiLoans || [])
    .filter((loan) => {
      return Boolean(loan.name) || Boolean(loan.productType) ||
        (loan.monthlyEmiAmount || 0) > 0 || (loan.principalAmount || 0) > 0 ||
        (loan.totalInterestAmount || 0) > 0 || (loan.estimatedInterestRate || 0) > 0 ||
        Boolean(loan.startDate) || Boolean(loan.endDate);
    })
    .map((loan, index) => ({
      id: `emi-${index}`,
      name: loan.name || loan.productType || `Loan ${index + 1}`,
      productType: loan.productType,
      monthlyEmi: loan.monthlyEmiAmount || 0,
      principal: loan.principalAmount || 0,
      totalInterest: loan.totalInterestAmount || 0,
      rate: loan.estimatedInterestRate || 0,
      window: formatLoanWindow(loan.startDate, loan.endDate),
    }));

  const totalEmiFromList = loans.reduce((sum, loan) => sum + loan.monthlyEmi, 0);
  const totalEmi = totalEmiFromList || profile.emi || 0;

  const simpleRows: SimpleRow[] = [];
  if (profile.rent > 0) simpleRows.push({ id: "rent", name: "Rent", amount: profile.rent, icon: Home });
  if (profile.monthlyExpenses > 0) simpleRows.push({ id: "expenses", name: "Monthly expenses", amount: profile.monthlyExpenses, icon: Receipt });

  // Only fall back to the consolidated EMI line when nothing else can be
  // unpacked. The CommitmentsCard renders a hint pointing the user to the
  // profile editor so they can add per-loan detail.
  const legacyEmiOnly = !loans.length && (profile.emi || 0) > 0 ? profile.emi : 0;

  return {
    rent: profile.rent || 0,
    totalEmi,
    monthlyExpenses: profile.monthlyExpenses || 0,
    loans,
    simpleRows,
    items: simpleRows.length || loans.length || legacyEmiOnly
      ? [...simpleRows, ...(legacyEmiOnly ? [{ id: "emi-legacy", name: "EMIs", amount: legacyEmiOnly, icon: Repeat }] : [])]
      : [],
    legacyEmiOnly,
  };
}

type LoanRow = {
  id: string;
  name: string;
  productType: string;
  monthlyEmi: number;
  principal: number;
  totalInterest: number;
  rate: number;
  window: string;
};

type SimpleRow = { id: string; name: string; amount: number; icon: typeof Home };

function formatLoanWindow(start: string, end: string) {
  const startLabel = formatLoanDate(start);
  const endLabel = formatLoanDate(end);
  if (!startLabel && !endLabel) return "—";
  if (startLabel && endLabel) return `${startLabel} → ${endLabel}`;
  return startLabel || endLabel;
}

function formatLoanDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

