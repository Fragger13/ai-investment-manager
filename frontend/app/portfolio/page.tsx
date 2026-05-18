"use client";

import { useEffect, useState } from "react";
import { BarChart3, CircleDollarSign, RefreshCcw, Shield } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AllocationChart, ProjectionChart } from "@/components/charts";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { emptyDashboard } from "@/lib/profile";
import { inr } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { DashboardData } from "@/types";

export default function PortfolioPage() {
  const profile = useAuthStore((state) => state.profile);
  const [data, setData] = useState<DashboardData>(emptyDashboard);

  useEffect(() => {
    if (profile) api.dashboard(profile).then(setData);
  }, [profile]);

  const diversification = Math.min(96, data.allocation.length * 12);

  return (
    <AppShell>
      <PageHeader title="Portfolio Overview" subtitle="Your investments grouped by type, with simple diversification and rebalancing suggestions." badge="Portfolio analysis" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Net worth" value={inr(data.summary.netWorth)} detail="Current portfolio base" icon={CircleDollarSign} />
        <MetricCard label="Diversification" value={`${diversification}%`} detail="Spread across investment types" icon={Shield} />
        <MetricCard label="Monthly surplus" value={inr(data.summary.investableSurplus)} detail="Fresh money available" icon={BarChart3} />
        <MetricCard label="Suggested actions" value={String(data.health.actions.length)} detail="Based on current profile" icon={RefreshCcw} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AllocationChart data={data.allocation} />
        <ProjectionChart data={data.projection} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {data.health.actions.slice(0, 3).map((action, index) => (
          <Card key={action}>
            <CardHeader><CardTitle>Action {index + 1}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{action}</p>
              <div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>Priority</span><span>{90 - index * 8}%</span></div>
              <Progress value={90 - index * 8} className="mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
