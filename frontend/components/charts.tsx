"use client";

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inr } from "@/lib/utils";

export function AllocationChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <Card className="min-h-[360px]">
      <CardHeader>
        <CardTitle>Portfolio Allocation</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={64} outerRadius={100} paddingAngle={3}>
              {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
            <Tooltip formatter={(value) => inr(Number(value))} contentStyle={{ background: "#0b161d", border: "1px solid rgba(255,255,255,.18)", borderRadius: 8, color: "#f8fafc" }} itemStyle={{ color: "#f8fafc" }} labelStyle={{ color: "#f8fafc" }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ProjectionChart({ data }: { data: { month: string; value: number }[] }) {
  return (
    <Card className="min-h-[360px]">
      <CardHeader>
        <CardTitle>Growth Projection</CardTitle>
        <p className="text-xs text-muted-foreground">Labels use full month names, for example Month 1 and Month 2.</p>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="projection" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2ac8b0" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#2ac8b0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
            <XAxis dataKey="month" stroke="#8aa0aa" fontSize={12} />
            <YAxis stroke="#8aa0aa" fontSize={12} tickFormatter={(value) => `₹${Math.round(Number(value) / 100000)}L`} />
            <Tooltip formatter={(value) => inr(Number(value))} contentStyle={{ background: "#0b161d", border: "1px solid rgba(255,255,255,.18)", borderRadius: 8, color: "#f8fafc" }} itemStyle={{ color: "#f8fafc" }} labelStyle={{ color: "#f8fafc" }} />
            <Area type="monotone" dataKey="value" stroke="#2ac8b0" fill="url(#projection)" strokeWidth={2} />
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
        <CardTitle>Category Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
            <XAxis dataKey="name" stroke="#8aa0aa" fontSize={12} />
            <YAxis stroke="#8aa0aa" fontSize={12} tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} />
            <Tooltip formatter={(value) => inr(Number(value))} contentStyle={{ background: "#0b161d", border: "1px solid rgba(255,255,255,.18)", borderRadius: 8, color: "#f8fafc" }} itemStyle={{ color: "#f8fafc" }} labelStyle={{ color: "#f8fafc" }} />
            <Bar dataKey="value" fill="#5fb0ff" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
