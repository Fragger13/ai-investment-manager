"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, CreditCard, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ExpenseChart } from "@/components/charts";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { emptyDashboard } from "@/lib/profile";
import { inr } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { DashboardData } from "@/types";

export default function ExpensesPage() {
  const profile = useAuthStore((state) => state.profile);
  const [data, setData] = useState<DashboardData>(emptyDashboard);

  useEffect(() => {
    if (profile) api.dashboard(profile).then(setData);
  }, [profile]);

  const savingsTarget = Math.round(data.summary.monthlyIncome * 0.25);

  return (
    <AppShell>
      <PageHeader title="Spending & Savings" subtitle="A simple view of what comes in, what goes out, and what may need attention." badge="Monthly money review" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Monthly expenses" value={inr(data.summary.monthlyExpenses)} detail="Total spending per month" icon={CreditCard} />
        <MetricCard label="Starter savings target" value={inr(savingsTarget)} detail="25% of monthly inflow" icon={Target} />
        <MetricCard label="Subscriptions" value={inr(profile?.subscriptions || 0)} detail="Recurring commitments" icon={Bell} />
        <MetricCard label="Warnings" value={String(data.alerts.length)} detail="Items to review" icon={AlertTriangle} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <ExpenseChart data={data.expenseCategories} />
        <Card>
          <CardHeader><CardTitle>Spending Warnings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data.alerts.length ? data.alerts : ["No urgent spending warning was found. Keep reviewing expenses monthly."]).map((alert) => (
              <div key={alert} className="rounded-md border border-warning/25 bg-warning-soft p-4 text-sm leading-6 text-warning-foreground">{alert}</div>
            ))}
            <div className="rounded-md border border-border bg-surface-soft p-4">
              <p className="text-sm font-medium text-foreground">Why this matters</p>
              <p className="mt-2 text-sm text-muted-foreground">Lower recurring spending gives you more room for emergency money, goals, and investments without taking extra risk.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
