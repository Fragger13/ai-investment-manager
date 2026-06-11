"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ColorfulIcon } from "@/components/colorful-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { DataMode, MarketRegime, MarketSignal, ResearchStatus } from "@/types";

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

const emptyRegime: MarketRegime = {
  regimeName: "limited-data",
  confidenceScore: 25,
  drivers: ["Refresh market updates to see the latest overall conditions."],
  supportingEvidence: [],
  contradictoryEvidence: [],
  recommendedPortfolioStance: "Refresh the latest information before making a major change to your investments.",
  summary: "A market overview is not available yet.",
  dataMode: "limited",
  retrievedAt: ""
};

export default function MarketPage() {
  const [signals, setSignals] = useState<MarketSignal[]>([]);
  const [status, setStatus] = useState<ResearchStatus>(emptyStatus);
  const [regime, setRegime] = useState<MarketRegime>(emptyRegime);
  const [loading, setLoading] = useState(false);

  async function load(refresh = false) {
    setLoading(true);
    try {
      if (refresh) await api.refreshMarketIntelligence().catch(() => null);
      const [nextRegime, nextSignals, nextStatus] = await Promise.all([api.marketRegime(), api.marketSignals(), api.researchStatus()]);
      setRegime(nextRegime);
      setSignals(nextSignals);
      setStatus(nextStatus);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  const topSignals = useMemo(() => signals.slice(0, 12), [signals]);
  const mode = regime.dataMode || status.dataMode || "limited";

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-normal text-foreground">Learn</h1>
          <p className="mt-2 text-lg text-muted-foreground">Simple market updates: what happened, why it matters, and what you can do.</p>
        </div>
        <Button variant="outline" onClick={() => load(true)} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> {loading ? "Refreshing..." : "Refresh market updates"}
        </Button>
      </div>

      <Card className="mb-5 border-primary/20 bg-primary/5">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={regime.regimeName.includes("risk") || regime.regimeName.includes("bear") ? "warn" : "good"}>{friendlyMarketCondition(regime.regimeName)}</Badge>
              <Badge tone="neutral">{regime.confidenceScore}% confidence</Badge>
              <Badge tone="neutral">{labelForMode(mode)} information</Badge>
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-foreground">What the market looks like right now</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/80">{simpleText(regime.summary)}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{simpleText(regime.recommendedPortfolioStance)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="font-semibold text-foreground">What to watch</p>
            <div className="mt-3 space-y-2">
              {regime.drivers.slice(0, 3).map((driver) => <p key={driver} className="rounded-xl bg-surface px-3 py-2 text-sm text-foreground/80">{simpleText(driver)}</p>)}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {topSignals.map((signal, index) => <LearnCard key={`${signal.id || index}-${signal.title}`} signal={signal} />)}
      </div>
      {!topSignals.length ? <Card><CardContent className="p-6 text-sm text-muted-foreground">No market lessons are available yet. Refresh market updates to load simple explanations.</CardContent></Card> : null}

      <p className="mt-5 text-xs text-muted-foreground">Last updated: {status.latestRetrievedAt || "Not refreshed yet"}</p>
    </AppShell>
  );
}

function LearnCard({ signal }: { signal: MarketSignal }) {
  const headline = marketHeadline(signal);
  const why = marketWhy(signal);
  const doNext = signal.what_to_watch_next || signal.whatToWatchNext || signal.user_relevance || "Do not rush. Watch whether this update starts affecting your investments or goals.";
  const Icon = signal.sentiment === "bearish" ? TrendingDown : signal.sentiment === "bullish" ? TrendingUp : BookOpen;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="w-full text-left">
          <Card className="h-full transition hover:border-primary/40 hover:bg-surface-hover">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <ColorfulIcon icon={Icon} accent={signal.sentiment === "bearish" ? "rose" : signal.sentiment === "bullish" ? "emerald" : "blue"} label="Market lesson" />
                  <div>
                    <h2 className="line-clamp-2 text-xl font-semibold text-foreground">{headline}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{why}</p>
                  </div>
                </div>
                <Badge tone={signal.sentiment === "bearish" ? "danger" : signal.sentiment === "bullish" ? "good" : "neutral"}>{friendlyDirection(signal.sentiment)}</Badge>
              </div>
              <div className="mt-4 grid gap-3">
                <Mini label="What happened?" value={headline} />
                <Mini label="Why does it matter?" value={why} />
                <Mini label="What should I do?" value={doNext} />
              </div>
            </CardContent>
          </Card>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[min(780px,94vw)] overflow-hidden p-0">
        <div className="border-b border-border bg-surface-elevated px-6 py-5 pr-12">
          <DialogTitle className="text-2xl font-semibold text-foreground">{headline}</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">{friendlySignalType(signal.signalType)} · {friendlyDirection(signal.sentiment)}</DialogDescription>
        </div>
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-6">
          <div className="grid gap-4">
            <Info title="What happened?" text={headline} />
            <Info title="Why does it matter?" text={why} />
            <Info title="What should I do?" text={doNext} />
            <details className="rounded-2xl border border-border bg-surface-soft p-4">
              <summary className="cursor-pointer font-medium text-foreground">Advanced View</summary>
              <div className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
                <p>Who could benefit: {(signal.likelyBeneficiaries || signal.who_benefits || []).slice(0, 5).join(", ") || "Not clear yet."}</p>
                <p>Who could be hurt: {(signal.likelyLosers || signal.who_is_at_risk || signal.riskSignals || []).slice(0, 5).join(", ") || "Not clear yet."}</p>
                <p>Source: {signal.sourceName || "Market source"} · Confidence: {signal.confidenceScore}%</p>
              </div>
            </details>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 line-clamp-2 text-sm text-foreground/85">{simpleText(value)}</p></div>;
}

function Info({ title, text }: { title: string; text: string }) {
  return <Card><CardContent className="p-4"><p className="font-semibold text-foreground">{title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{simpleText(text)}</p></CardContent></Card>;
}

function marketHeadline(signal: MarketSignal) {
  return simpleText(signal.clean_headline || signal.cleanHeadline || signal.cleanSummary?.whatHappened || signal.title || "Market update");
}

function marketWhy(signal: MarketSignal) {
  return simpleText(signal.why_it_matters || signal.whyItMatters || signal.cleanSummary?.whyItMatters || signal.summary || "This is useful context for your investments.");
}

function simpleText(value?: string) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text === "undefined" || text === "null") return "Limited information is available.";
  return text.length > 220 ? `${text.slice(0, 205).replace(/\s+\S*$/, "")}.` : /[.!?]$/.test(text) ? text : `${text}.`;
}

function friendlyMarketCondition(value: string) {
  const labels: Record<string, string> = {
    "limited-data": "More information needed",
    "risk-on": "Investors are feeling confident",
    "risk-off": "Investors are being careful",
    "bull market": "Markets are generally rising",
    "bear market": "Markets are generally falling",
    "high volatility": "Markets are moving sharply",
    balanced: "Mixed conditions",
  };
  return labels[value.toLowerCase()] || value;
}

function friendlyDirection(value: string) {
  if (value === "bullish") return "Positive";
  if (value === "bearish") return "Negative";
  if (value === "neutral") return "Mixed";
  return value || "Mixed";
}

function friendlySignalType(value?: string) {
  const labels: Record<string, string> = {
    macro: "Wider market update",
    technical: "Price trend update",
    fundamental: "Business update",
    geopolitical: "Global events update",
    sentiment: "Investor mood update",
    policy: "Policy update",
  };
  return value ? labels[value.toLowerCase()] || value : "Market update";
}

function labelForMode(mode: DataMode) {
  if (mode === "live") return "Live";
  if (mode === "cached") return "Cached";
  if (mode === "limited") return "Limited";
  return "Basic";
}
