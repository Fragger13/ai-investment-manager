import Link from "next/link";
import { ArrowRight, BrainCircuit, ChartPie, CircleDollarSign, Landmark, LineChart, ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const values = [
  { title: "AI Wealth Manager", text: "Turns fragmented money data into daily actions, trade-offs, and plain-English reasoning.", icon: BrainCircuit },
  { title: "Portfolio Intelligence", text: "Tracks allocation, diversification, concentration risk, and rebalancing opportunities.", icon: ChartPie },
  { title: "Expense Discipline", text: "Finds overspending patterns, subscription leakage, and lifestyle inflation before they compound.", icon: ShieldCheck },
  { title: "Goal Planning", text: "Organizes house, emergency, retirement, travel, and freedom goals with feasibility scores.", icon: Target },
  { title: "Explainable Recommendations", text: "Every suggestion carries timing, confidence, risk, and best/base/worst case logic.", icon: LineChart }
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="grid-bg absolute inset-0" />
      <section className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Landmark className="h-5 w-5" />
            </span>
            <span className="font-semibold text-white">AI Investment Manager</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link href="/login">Login</Link></Button>
            <Button asChild><Link href="/register">Get Started</Link></Button>
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.02fr_.98fr]">
          <div>
            <Badge tone="good">AI-native wealth intelligence for India</Badge>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-normal text-white md:text-7xl">
              Personal wealth decisions with the clarity of an analyst desk.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Connect your financial profile, understand your cashflow, track portfolio risk, plan goals, and get explainable investment recommendations built around your life.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild><Link href="/register">Get Started <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button size="lg" variant="outline" asChild><Link href="/login">Login</Link></Button>
            </div>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Financial command center</p>
                    <p className="mt-2 text-3xl font-semibold text-white">₹41.5L</p>
                  </div>
                  <CircleDollarSign className="h-10 w-10 text-primary" />
                </div>
              </div>
              <div className="grid gap-px bg-white/10 md:grid-cols-2">
                {["Savings rate 42%", "Health score 82", "Risk Balanced", "Surplus ₹1.2L"].map((item) => (
                  <div key={item} className="bg-[#09141b] p-5 text-sm text-slate-200">{item}</div>
                ))}
              </div>
              <div className="p-5">
                <div className="rounded-lg border border-primary/20 bg-primary/[0.08] p-4">
                  <p className="text-sm font-medium text-primary">AI recommendation</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Prioritize emergency liquidity for 5 months, then increase broad-market SIPs while capping tactical exposure at 8%.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="relative mx-auto grid max-w-7xl gap-4 px-6 pb-16 md:grid-cols-2 lg:grid-cols-5">
        {values.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardContent className="p-5">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="mt-4 text-sm font-semibold text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
