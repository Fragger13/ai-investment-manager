"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { emptyDashboard } from "@/lib/profile";
import { inr } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { DashboardData } from "@/types";

export default function GoalsPage() {
  const profile = useAuthStore((state) => state.profile);
  const [data, setData] = useState<DashboardData>(emptyDashboard);

  useEffect(() => {
    if (profile) api.dashboard(profile).then(setData);
  }, [profile]);

  return (
    <AppShell>
      <PageHeader title="Goal Planning" subtitle="See monthly savings needed, timeline feasibility, and EMI impact for your major goals." badge="Goal planning" />
      <div className="grid gap-4 md:grid-cols-2">
        {data.goals.map((goal) => (
          <Card key={goal.id}>
            <CardHeader><CardTitle>{goal.name}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{inr(goal.currentProgress)}</span>
                <span>{inr(goal.targetAmount)}</span>
              </div>
              <Progress value={goal.targetAmount ? (goal.currentProgress / goal.targetAmount) * 100 : 0} className="mt-2" />
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-white/5 p-3"><p className="text-muted-foreground">Monthly needed</p><p className="mt-1 text-white">{inr(goal.requiredMonthlyInvestment)}</p></div>
                <div className="rounded-md bg-white/5 p-3"><p className="text-muted-foreground">Feasibility</p><p className="mt-1 text-white">{goal.feasibilityScore}%</p></div>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{goal.explanation}</p>
              <p className="mt-2 text-sm text-muted-foreground">Timeline: {goal.timelineProjection}</p>
              {goal.estimatedEmi ? <p className="mt-2 text-sm text-slate-300">Estimated EMI: {inr(goal.estimatedEmi)}</p> : null}
              {goal.affordabilityWarning ? <p className="mt-2 text-sm text-amber-200">{goal.affordabilityWarning}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
      {!profile ? <Card className="mt-4"><CardContent className="p-5 text-sm text-muted-foreground">Complete onboarding to calculate goals from your real profile.</CardContent></Card> : null}
    </AppShell>
  );
}
