"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarCheck, Flag, Gauge } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { emptyDashboard } from "@/lib/profile";
import { useEnsureProfile } from "@/lib/use-ensure-profile";
import { DashboardData } from "@/types";

export default function AlertsPage() {
  const profile = useEnsureProfile();
  const [data, setData] = useState<DashboardData>(emptyDashboard);

  useEffect(() => {
    if (profile) api.dashboard(profile).then(setData);
  }, [profile]);

  const alerts = useMemo(() => [
    ...data.alerts.map((detail) => ({ title: "Money warning", severity: "High", type: "Profile", detail })),
    ...data.health.actions.map((detail) => ({ title: "Recommended next step", severity: "Medium", type: "Action", detail })),
    ...data.behavior.suggestedNudges.map((detail) => ({ title: "Helpful reminder", severity: "Low", type: "Habits", detail }))
  ], [data]);
  const high = alerts.filter((item) => item.severity === "High").length;
  const medium = alerts.filter((item) => item.severity === "Medium").length;

  return (
    <AppShell>
      <PageHeader title="Alerts & Reviews" subtitle="Simple reminders about your spending, goals, comfort with risk, and money habits." badge="Stay on track" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open alerts" value={String(alerts.length)} detail="Across spending, goals, and your investments" icon={BellRing} />
        <MetricCard label="High priority" value={String(high)} detail="Review before adding more investment risk" icon={Flag} />
        <MetricCard label="Medium priority" value={String(medium)} detail="Review this month" icon={Gauge} />
        <MetricCard label="How often to review" value="Monthly" detail="Keep your financial details up to date" icon={CalendarCheck} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {alerts.map((alert) => (
          <Card key={`${alert.title}-${alert.detail}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{alert.title}</CardTitle>
                <Badge tone={alert.severity === "High" ? "danger" : alert.severity === "Medium" ? "warn" : "good"}>{alert.severity}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Badge tone="neutral">{alert.type}</Badge>
              <p className="mt-4 text-sm leading-6 text-foreground/80">{alert.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
