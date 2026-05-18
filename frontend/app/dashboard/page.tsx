"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, CircleDollarSign, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AllocationChart, ExpenseChart, ProjectionChart } from "@/components/charts";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { RecommendationCard } from "@/components/recommendation-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { emptyDashboard } from "@/lib/profile";
import { inr, pct } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { DashboardData, OnboardingProfile } from "@/types";

export default function DashboardPage() {
  const profile = useAuthStore((state) => state.profile);
  const saveProfile = useAuthStore((state) => state.saveProfile);
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let activeProfile: OnboardingProfile | null = profile;
      if (!activeProfile) {
        const latest = await api.latestProfile().catch(() => ({ profile: null }));
        activeProfile = latest.profile;
        if (activeProfile) saveProfile(activeProfile, true);
      }
      if (activeProfile) {
        setData(await api.dashboard(activeProfile));
      } else {
        setData(emptyDashboard);
      }
      setLoading(false);
    }
    load();
  }, [profile, saveProfile]);

  const needsProfile = !profile && !data.summary.monthlyIncome;

  return (
    <AppShell>
      <PageHeader
        title="Your Money Dashboard"
        subtitle="A simple view of income, spending, savings, goals, investments, market updates, and suggested next steps."
        badge={data.summary.riskProfile}
      />
      {needsProfile ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-lg font-semibold text-white">Complete onboarding to see your real dashboard.</p>
            <p className="mt-2 text-sm text-muted-foreground">The app no longer fills the dashboard with random sample data.</p>
            <Button className="mt-4" asChild><a href="/onboarding">Start onboarding</a></Button>
          </CardContent>
        </Card>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading your profile...</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Net worth" value={inr(data.summary.netWorth)} detail="What you own minus what you owe" icon={CircleDollarSign} />
        <MetricCard label="Monthly inflow" value={inr(data.summary.monthlyIncome)} detail="Money received every month" icon={TrendingUp} />
        <MetricCard label="Monthly expenses" value={inr(data.summary.monthlyExpenses)} detail="Money going out every month" icon={TrendingDown} />
        <MetricCard label="Savings rate" value={pct(data.summary.savingsRate)} detail="How much income is left after expenses" icon={PiggyBank} />
        <MetricCard label="Monthly surplus" value={inr(data.summary.investableSurplus)} detail="Amount available for goals and investing" icon={BrainCircuit} />
      </div>

      <Card className="mt-4">
        <CardContent className="p-5 text-sm leading-6 text-slate-300">
          <p><span className="font-semibold text-white">Confidence score</span> means how strongly the system believes a recommendation fits your current profile and market data. It is not a guarantee of returns.</p>
          <p className="mt-2 text-amber-100">{data.disclaimer}</p>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Your Financial Health Score</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">{data.health.explanation}</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <span className="text-6xl font-semibold text-white">{data.health.score}</span>
              <span className="pb-2 text-muted-foreground">/ 100</span>
            </div>
            <Progress value={data.health.score} className="mt-5" />
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{data.health.whyItMatters}</p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <InsightList title="What looks good" items={data.health.strengths} tone="good" />
              <InsightList title="What needs attention" items={data.health.weaknesses} tone="warn" />
              <InsightList title="Next actions" items={data.health.actions} tone="neutral" />
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <AllocationChart data={data.allocation} />
          <ProjectionChart data={data.projection} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <div className="space-y-4">
          <ExpenseChart data={data.expenseCategories} />
          <Card>
            <CardHeader><CardTitle>Beginner-Friendly Risk Warnings</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(data.alerts.length ? data.alerts : ["No urgent warning detected from your saved profile."]).map((alert) => (
                <div key={alert} className="rounded-md border border-amber-300/15 bg-amber-400/[0.08] p-3 text-sm text-amber-100">{alert}</div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Money Behavior</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <p>Spending discipline: {data.behavior.spendingDiscipline || "Complete onboarding"}</p>
              <p>Impulse spending risk: {data.behavior.impulseSpendingRisk || "Complete onboarding"}</p>
              <p>Panic-selling risk: {data.behavior.panicSellingRisk || "Complete onboarding"}</p>
              {data.behavior.suggestedNudges.map((nudge) => <div key={nudge} className="rounded-md bg-white/5 p-3">{nudge}</div>)}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.recommendations.slice(0, 2).map((rec) => <RecommendationCard key={rec.id} rec={rec} compact />)}
          <Card>
            <CardHeader><CardTitle>Goal Progress</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {data.goals.map((goal) => (
                <div key={goal.id}>
                  <div className="mb-2 flex justify-between gap-3 text-sm">
                    <span className="text-white">{goal.name}</span>
                    <span className="text-muted-foreground">{goal.feasibilityScore}% feasible</span>
                  </div>
                  <Progress value={goal.targetAmount ? (goal.currentProgress / goal.targetAmount) * 100 : 0} />
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{goal.explanation}</p>
                  {goal.affordabilityWarning ? <p className="mt-1 text-xs text-amber-200">{goal.affordabilityWarning}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Market Updates & Opportunities</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">Simplified insights from market and research sources that may affect your investment decisions.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.market.map((item) => (
                <div key={item.title} className="rounded-md bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <Badge tone={item.tone === "Opportunity" ? "good" : item.tone === "Warning" ? "warn" : "neutral"}>{item.confidence}%</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">Why it matters: {item.whyItMatters}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {item.sources.map((source) => <a key={`${item.title}-${source.name}`} className="text-primary" href={source.url} target="_blank" rel="noreferrer">{source.name}</a>)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function InsightList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "warn" | "neutral" }) {
  return (
    <div>
      <Badge tone={tone}>{title}</Badge>
      <ul className="mt-3 space-y-2 text-sm text-slate-300">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
