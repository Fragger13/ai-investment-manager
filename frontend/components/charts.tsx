"use client";

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inr } from "@/lib/utils";

const tooltipStyle = {
  background: "hsl(var(--surface-elevated))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--text-primary))"
};
const tooltipTextStyle = { color: "hsl(var(--text-primary))" };
const chartGrid = "hsl(var(--chart-grid))";
const chartAxis = "hsl(var(--chart-axis))";
const chartPrimary = "hsl(var(--chart-primary))";
const chartSecondary = "hsl(var(--chart-secondary))";

export function AllocationChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <Card className="min-h-[360px]">
      <CardHeader>
        <CardTitle>Where Your Money Is Invested</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,.85fr)] md:items-center">
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(value) => inr(Number(value))} contentStyle={tooltipStyle} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-start justify-between gap-3 rounded-md bg-surface-soft px-3 py-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="truncate text-muted-foreground">{entry.name}</span>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium text-foreground">{inr(entry.value)}</p>
                <p className="mt-0.5 text-muted-foreground">{total ? Math.round(entry.value / total * 100) : 0}%</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectionChart({ data }: { data: { month: string; value: number }[] }) {
  return (
    <Card className="min-h-[360px]">
      <CardHeader>
        <CardTitle>How Your Money Could Grow</CardTitle>
        <p className="text-xs text-muted-foreground">This is an estimate, not a guarantee.</p>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="projection" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.5} />
                <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={chartGrid} vertical={false} />
            <XAxis dataKey="month" stroke={chartAxis} fontSize={12} />
            <YAxis stroke={chartAxis} fontSize={12} tickFormatter={(value) => `₹${Math.round(Number(value) / 100000)}L`} />
            <Tooltip formatter={(value) => inr(Number(value))} contentStyle={tooltipStyle} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} />
            <Area type="monotone" dataKey="value" stroke={chartPrimary} fill="url(#projection)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ExpenseChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where Your Money Goes</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke={chartGrid} vertical={false} />
            <XAxis dataKey="name" stroke={chartAxis} fontSize={12} />
            <YAxis stroke={chartAxis} fontSize={12} tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} />
            <Tooltip formatter={(value) => inr(Number(value))} contentStyle={tooltipStyle} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} />
            <Bar dataKey="value" fill={chartSecondary} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
