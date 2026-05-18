"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { inr } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { AdvancedRecommendation, AdvancedRecommendationResponse, DataMode, RiskLevel } from "@/types";

const emptyAdvanced: AdvancedRecommendationResponse = {
  recommendations: [],
  signals: [],
  assets: [],
  dataMode: "fallback",
  lastResearchedAt: "",
  sourceCount: 0,
  disclaimer: "These recommendations are research-backed decision-support outputs, not guaranteed financial advice. Please verify before investing. Investments involve risk."
};

const riskFilters = ["All", "Low", "Medium", "High"] as const;
const sortOptions = ["highest suitability", "highest confidence", "lowest risk", "highest priority"] as const;

export default function RecommendationsPage() {
  const profile = useAuthStore((state) => state.profile);
  const [data, setData] = useState<AdvancedRecommendationResponse>(emptyAdvanced);
  const [loading, setLoading] = useState(false);
  const [risk, setRisk] = useState<(typeof riskFilters)[number]>("All");
  const [assetClass, setAssetClass] = useState("All");
  const [goal, setGoal] = useState("All");
  const [horizon, setHorizon] = useState("All");
  const [sourceBackedOnly, setSourceBackedOnly] = useState("No");
  const [minimumConfidence, setMinimumConfidence] = useState("0");
  const [sort, setSort] = useState<(typeof sortOptions)[number]>("highest suitability");

  async function load(refreshResearch = false) {
    setLoading(true);
    const result = await api.generateAdvancedRecommendations(profile, refreshResearch);
    setData(result);
    setLoading(false);
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const assetClasses = useMemo(() => ["All", ...Array.from(new Set(data.recommendations.map((item) => item.assetType)))], [data.recommendations]);
  const goals = useMemo(() => ["All", ...Array.from(new Set(data.recommendations.map((item) => item.goalTag)))], [data.recommendations]);
  const horizons = useMemo(() => ["All", ...Array.from(new Set(data.recommendations.map((item) => item.timeHorizon)))], [data.recommendations]);

  const items = useMemo(() => {
    const riskRank: Record<RiskLevel, number> = { Low: 1, Medium: 2, High: 3 };
    return data.recommendations
      .filter((rec) => risk === "All" || rec.riskLevel === risk)
      .filter((rec) => assetClass === "All" || rec.assetType === assetClass)
      .filter((rec) => goal === "All" || rec.goalTag === goal)
      .filter((rec) => horizon === "All" || rec.timeHorizon === horizon)
      .filter((rec) => sourceBackedOnly === "No" || rec.sourceLinks.length > 0)
      .filter((rec) => rec.confidenceScore >= Number(minimumConfidence))
      .sort((a, b) => {
        if (sort === "highest confidence") return b.confidenceScore - a.confidenceScore;
        if (sort === "lowest risk") return riskRank[a.riskLevel] - riskRank[b.riskLevel];
        if (sort === "highest priority") return a.priorityOrder - b.priorityOrder;
        return b.suitabilityScore - a.suitabilityScore;
      });
  }, [assetClass, data.recommendations, goal, horizon, minimumConfidence, risk, sort, sourceBackedOnly]);

  return (
    <AppShell>
      <PageHeader
        title="Research-Backed Recommendations"
        subtitle="Specific instruments, source links, supporting evidence, conflicting evidence, action plans, and clear fallback/live data labels."
        badge={`${labelForMode(data.dataMode)} research`}
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm leading-6 text-slate-300">
          <div>
            <p>{data.disclaimer}</p>
            <p className="mt-1 text-muted-foreground">Last researched: {data.lastResearchedAt || "Not refreshed yet"} · Sources: {data.sourceCount} · Mode: {labelForMode(data.dataMode)}</p>
          </div>
          <Button onClick={() => load(true)} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> {loading ? "Refreshing..." : "Refresh research"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><SlidersHorizontal className="h-4 w-4" /> Filters and sort</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Filter label="Risk" value={risk} values={riskFilters as unknown as string[]} onChange={(value) => setRisk(value as typeof risk)} />
          <Filter label="Asset class" value={assetClass} values={assetClasses} onChange={setAssetClass} />
          <Filter label="Goal" value={goal} values={goals} onChange={setGoal} />
          <Filter label="Time horizon" value={horizon} values={horizons} onChange={setHorizon} />
          <Filter label="Source-backed only" value={sourceBackedOnly} values={["No", "Yes"]} onChange={setSourceBackedOnly} />
          <Filter label="Min confidence" value={minimumConfidence} values={["0", "60", "70", "80"]} onChange={setMinimumConfidence} />
          <Filter label="Sort" value={sort} values={sortOptions as unknown as string[]} onChange={(value) => setSort(value as typeof sort)} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((rec) => <AdvancedRecommendationDialog key={rec.id} rec={rec} />)}
      </div>
    </AppShell>
  );
}

function Filter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {values.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function AdvancedRecommendationDialog({ rec }: { rec: AdvancedRecommendation }) {
  const riskTone = rec.riskLevel === "High" ? "danger" : rec.riskLevel === "Medium" ? "warn" : "good";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-left">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{rec.recommendationTitle}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{rec.instrumentName} · {rec.assetType}</p>
                </div>
                <Badge tone={riskTone}>{rec.riskLevel}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric label="Monthly amount" value={inr(rec.suggestedMonthlyAmount)} />
                <Metric label="Allocation" value={`${rec.suggestedAllocationPercentage}%`} />
                <Metric label="Suitability" value={`${rec.suitabilityScore}%`} />
                <Metric label="Sources" value={String(rec.sourceLinks.length)} />
              </div>
              <Score label="Confidence" value={rec.confidenceScore} />
              <p className="text-sm leading-6 text-slate-300">{rec.userSpecificReasoning}</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral">{labelForMode(rec.dataMode)}</Badge>
                <Badge tone="neutral">Priority {rec.priorityOrder}</Badge>
                <Badge tone="neutral">{rec.timeHorizon}</Badge>
              </div>
            </CardContent>
          </Card>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-2xl font-semibold text-white">{rec.instrumentName}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">{rec.recommendationTitle}</DialogDescription>
        <div className="mt-5 space-y-5 text-sm leading-6 text-slate-300">
          <section><p className="font-medium text-white">Why this may fit you</p><p>{rec.userSpecificReasoning}</p></section>
          <section><p className="font-medium text-white">Current research reasoning</p><p>{rec.currentMarketReasoning}</p></section>
          <section><p className="font-medium text-white">Suggested action plan</p><ul className="mt-2 list-disc space-y-1 pl-5">{rec.actionPlan.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <section><p className="font-medium text-white">Risk and what can go wrong</p><p>{rec.riskExplanation}</p><p className="mt-2 text-amber-100">{rec.whatCanGoWrong}</p></section>
          <section><p className="font-medium text-white">Entry and review</p><p>{rec.entryApproach}</p><p>Review date: {rec.reviewDate}</p><p>{rec.exitOrRebalanceCondition}</p></section>
          <Evidence title="Supporting evidence" signals={rec.supportingSignals} />
          <Evidence title="Conflicting evidence" signals={rec.contradictorySignals} />
          <section>
            <p className="font-medium text-white">Sources</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {rec.sourceLinks.map((source) => <a key={`${rec.id}-${source.url}`} href={source.url} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">{source.name} ({labelForMode(source.dataMode)})</a>)}
            </div>
          </section>
          <p className="rounded-md border border-amber-300/15 bg-amber-400/[0.08] p-3 text-amber-100">{rec.disclaimer}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/5 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>{label}</span><span>{value}%</span></div>
      <Progress value={value} />
    </div>
  );
}

function Evidence({ title, signals }: { title: string; signals: AdvancedRecommendation["supportingSignals"] }) {
  return (
    <section>
      <p className="font-medium text-white">{title}</p>
      <div className="mt-2 space-y-2">
        {signals.length ? signals.map((signal) => (
          <div key={`${signal.title}-${signal.sourceUrl}`} className="rounded-md bg-white/5 p-3">
            <p>{signal.title}</p>
            <p className="text-xs text-muted-foreground">{signal.sourceName} · {signal.sentiment} · {signal.confidenceScore}% confidence · {labelForMode(signal.dataMode)}</p>
          </div>
        )) : <p className="text-muted-foreground">No conflicting signal recorded in Phase 1.</p>}
      </div>
    </section>
  );
}

function labelForMode(mode: DataMode) {
  if (mode === "live") return "Live";
  if (mode === "delayed") return "Delayed cache";
  if (mode === "cached") return "Cached";
  if (mode === "limited") return "Limited";
  return "Fallback labelled";
}
