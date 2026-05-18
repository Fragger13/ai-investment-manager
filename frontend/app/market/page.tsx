"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, BrainCircuit, RefreshCw, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { DataMode, MarketSignal, ResearchSource, ResearchStatus } from "@/types";

const emptyStatus: ResearchStatus = {
  status: "not_refreshed",
  dataMode: "fallback",
  latestRetrievedAt: "",
  latestSignalAt: "",
  latestArticleAt: "",
  sourceCount: 0,
  signalCount: 0,
  articleCount: 0,
  assetCount: 0,
  logs: []
};

export default function MarketPage() {
  const [signals, setSignals] = useState<MarketSignal[]>([]);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [status, setStatus] = useState<ResearchStatus>(emptyStatus);
  const [loading, setLoading] = useState(false);
  const mode = useMemo<DataMode>(() => status.dataMode || signals.find((signal) => signal.dataMode)?.dataMode || "fallback", [signals, status.dataMode]);
  const bullish = signals.filter((signal) => signal.sentiment === "bullish").length;
  const bearish = signals.filter((signal) => signal.sentiment === "bearish").length;
  const neutral = signals.filter((signal) => signal.sentiment === "neutral").length;
  const riskSignals = signals.filter((signal) => signal.signalType === "risk warning").length;

  async function load(refresh = false) {
    setLoading(true);
    if (refresh) await api.refreshResearch(null).catch(() => null);
    const [nextSignals, nextSources, nextStatus] = await Promise.all([api.researchSignals(), api.researchSources(), api.researchStatus()]);
    setSignals(nextSignals);
    setSources(nextSources);
    setStatus(nextStatus);
    setLoading(false);
  }

  useEffect(() => {
    load(false);
  }, []);

  return (
    <AppShell>
      <PageHeader title="Market Intelligence" subtitle="Real RSS/API-backed signals where sources are reachable, with clear limited/fallback labels when a source fails." badge={`${labelForMode(mode)} data`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Signals stored" value={String(status.signalCount || signals.length)} detail="Extracted and cached" icon={Activity} />
        <MetricCard label="Risk warnings" value={String(riskSignals)} detail="Read before investing" icon={ShieldAlert} />
        <MetricCard label="Bullish / bearish / neutral" value={`${bullish} / ${bearish} / ${neutral}`} detail="Signal sentiment mix" icon={BarChart3} />
        <MetricCard label="Sources configured" value={String(status.sourceCount || sources.length)} detail="Registry entries" icon={BrainCircuit} />
      </div>

      <Card className="mt-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="text-sm leading-6 text-slate-300">
            <p>Status: <span className="text-white">{status.status}</span> · Latest retrieval: {status.latestRetrievedAt || "Not refreshed yet"}</p>
            <p className="text-muted-foreground">Articles: {status.articleCount} · Assets: {status.assetCount} · Mode: {labelForMode(mode)}</p>
          </div>
          <Button onClick={() => load(true)} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> {loading ? "Refreshing..." : "Refresh Research"}
          </Button>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {signals.map((signal) => (
          <Card key={`${signal.id}-${signal.sourceUrl}-${signal.title}`}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{signal.title}</CardTitle>
                <Badge tone={signal.sentiment === "bullish" ? "good" : signal.sentiment === "bearish" ? "danger" : "neutral"}>{signal.sentiment}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{signal.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone={signal.signalType === "risk warning" ? "warn" : "neutral"}>{signal.signalType}</Badge>
                <Badge tone="neutral">{labelForMode(signal.dataMode)}</Badge>
                <Badge tone="neutral">Credibility {signal.credibilityScore}</Badge>
              </div>
              <div className="mt-5 flex justify-between text-xs text-muted-foreground"><span>Confidence</span><span>{signal.confidenceScore}%</span></div>
              <Progress value={signal.confidenceScore} className="mt-2" />
              <div className="mt-4 text-xs leading-5 text-muted-foreground">
                <p>Retrieved: {signal.retrievedAt}</p>
                {signal.publishedAt ? <p>Published: {signal.publishedAt}</p> : null}
                <a className="text-primary underline-offset-4 hover:underline" href={signal.sourceUrl.startsWith("internal://") ? "#" : signal.sourceUrl} target="_blank" rel="noreferrer">{signal.sourceName}</a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Refresh Log</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {status.logs.slice(0, 8).map((log) => (
            <div key={`${log.sourceName}-${log.retrievedAt}`} className="rounded-md border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{log.sourceName}</p>
                <Badge tone={log.mode === "live" ? "good" : log.mode === "limited" ? "warn" : "neutral"}>{labelForMode(log.mode)}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{log.status} · {log.itemsProcessed} items · {log.retrievedAt}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{log.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle>Source Registry</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sources.slice(0, 12).map((source) => (
            <div key={source.sourceName} className="rounded-md border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{source.sourceName}</p>
                <Badge tone={source.enabled ? "good" : "neutral"}>{source.reliabilityScore}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{source.sourceType} · {source.allowedIngestionMethod} · {source.refreshFrequency}</p>
              <a href={source.baseUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline-offset-4 hover:underline">{source.baseUrl}</a>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function labelForMode(mode: DataMode) {
  if (mode === "live") return "Live";
  if (mode === "delayed") return "Delayed cache";
  if (mode === "cached") return "Cached";
  if (mode === "limited") return "Limited";
  return "Fallback labelled";
}
