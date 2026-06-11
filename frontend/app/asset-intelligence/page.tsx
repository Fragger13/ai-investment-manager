"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, Check, Filter, Search, Send, Shield, Sparkles, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ColorfulIcon } from "@/components/colorful-icon";
import { InvestmentLogo } from "@/components/investment-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn, inr } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { usePlanActionsStore } from "@/store/plan-actions-store";
import { AdvancedRecommendation, AdvancedRecommendationResponse, AlphaOpportunity, AssetIntelligence, CryptoOpportunity, OnboardingProfile } from "@/types";

export type InvestmentIdea = {
  id: string;
  slug: string;
  name: string;
  ticker: string;
  category: string;
  tab: "Recommended For You" | "Trending" | "Safe Options" | "High Growth" | "Under The Radar";
  risk: string;
  action: string;
  expectedReturn: string;
  suggestedAmount: number;
  bullets: string[];
  summary: string;
  whyNow: string;
  risks: string[];
  advanced: string[];
  livePrice?: { value: number; unit: string; asOf?: string } | null;
  buyRange?: string;
  sellRange?: string;
  raw?: AssetIntelligence | AlphaOpportunity | CryptoOpportunity | AdvancedRecommendation;
};

const emptyAdvanced: AdvancedRecommendationResponse = {
  recommendations: [],
  signals: [],
  assets: [],
  dataMode: "fallback",
  lastResearchedAt: "",
  sourceCount: 0,
  disclaimer: ""
};

const tabs: InvestmentIdea["tab"][] = ["Recommended For You", "Trending", "Safe Options", "High Growth", "Under The Radar"];

export default function AssetIntelligencePage() {
  const profile = useAuthStore((state) => state.profile);
  const [assets, setAssets] = useState<AssetIntelligence[]>([]);
  const [alpha, setAlpha] = useState<AlphaOpportunity[]>([]);
  const [crypto, setCrypto] = useState<CryptoOpportunity[]>([]);
  const [recommendations, setRecommendations] = useState<AdvancedRecommendationResponse>(emptyAdvanced);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<InvestmentIdea["tab"]>("Recommended For You");
  const [query, setQuery] = useState("");

  const allowsCrypto = useMemo(() => {
    const text = [profile?.drawdownTolerance, profile?.volatilityComfort, profile?.shortTermVolatilityComfort, profile?.opportunityPreference].join(" ").toLowerCase();
    return text.includes("high") || text.includes("growth") || (profile?.cryptoValue || 0) > 0;
  }, [profile]);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      if (refresh) await api.refreshAssetResearch().catch(() => null);
      const [nextRecommendations, nextAssets, nextAlpha, nextCrypto] = await Promise.all([
        api.generateAdvancedRecommendations(profile, false),
        api.assetIntelligence(),
        api.alphaOpportunities(),
        api.cryptoOpportunities()
      ]);
      setRecommendations(nextRecommendations);
      setAssets(nextAssets);
      setAlpha(nextAlpha);
      setCrypto(nextCrypto);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { load(false); }, [load]);

  const ideas = useMemo(() => {
    const priceByTicker = new Map<string, { value: number; unit: string }>();
    assets.forEach((asset) => {
      const ticker = (asset.ticker || "").toLowerCase();
      const price = asset.technical?.latestPrice;
      if (ticker && price) {
        priceByTicker.set(ticker, { value: price, unit: priceUnitFor(asset.normalizedAssetClass || asset.assetType || asset.category || "") });
      }
    });
    const output = [
      ...assets.map((asset) => mapAsset(asset, profile)),
      ...recommendations.recommendations.map((rec) => {
        const idea = mapRecommendation(rec, profile);
        const livePrice = priceByTicker.get((idea.ticker || "").toLowerCase());
        return livePrice ? { ...idea, livePrice } : idea;
      }),
      ...alpha.map((item) => mapAlpha(item, profile)),
      ...(allowsCrypto ? crypto.map((item) => mapCrypto(item, profile)) : []),
    ];
    return dedupe(output).sort((a, b) => scoreIdea(b) - scoreIdea(a));
  }, [alpha, allowsCrypto, assets, crypto, profile, recommendations.recommendations]);

  const visible = ideas
    .filter((idea) => idea.tab === activeTab || (activeTab === "Recommended For You" && scoreIdea(idea) >= 60))
    .filter((idea) => !query || `${idea.name} ${idea.ticker} ${idea.category}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 12);

  // Store ideas in sessionStorage so the detail page can read them
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.sessionStorage.setItem("aim-discover-ideas", JSON.stringify(ideas)); } catch { /* ignore */ }
  }, [ideas]);

  return (
    <AppShell sidebarExtra={<InviteWidget />}>
      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Discover Investments</h1>
          <p className="mt-2 text-base text-muted-foreground">Curated investment options that match your goals and risk profile.</p>
        </div>
        <div className="flex w-full gap-3 xl:w-auto">
          <div className="relative w-full min-w-[260px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search investments, funds..." className="pl-9" />
          </div>
          <Button variant="outline" onClick={() => load(true)} disabled={loading}><Filter className="h-4 w-4" /> Filters</Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === tab ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((idea) => <InvestmentCard key={idea.id} idea={idea} />)}
      </div>
      {!visible.length ? <Card><CardContent className="p-6 text-sm text-muted-foreground">No ideas match this view yet. Try another tab or refresh investment ideas.</CardContent></Card> : null}

      <Card className="mt-6 border-positive-soft bg-positive-soft/40">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <ColorfulIcon icon={Sparkles} accent="emerald" label="Coach" />
            <div>
              <p className="font-semibold text-foreground">Not sure where to start?</p>
              <p className="text-sm text-muted-foreground">Let your AI coach suggest the best investments for you.</p>
            </div>
          </div>
          <Button variant="outline" asChild><Link href="/chat">Ask AI Coach <Send className="h-4 w-4" /></Link></Button>
        </CardContent>
      </Card>
      <p className="mt-4 text-xs text-muted-foreground">All investments are subject to market risks. Read scheme-related documents carefully.</p>
    </AppShell>
  );
}

function InvestmentCard({ idea }: { idea: InvestmentIdea }) {
  const inPlan = usePlanActionsStore((state) => state.planItems.some((entry) => entry.key === idea.id));
  const addToPlan = usePlanActionsStore((state) => state.addToPlan);
  const removeFromPlan = usePlanActionsStore((state) => state.removeFromPlan);

  function toggleSave(event: React.MouseEvent) {
    // Card itself is a Link — stop the navigation when the user clicks the
    // bookmark icon so it just toggles save state.
    event.preventDefault();
    event.stopPropagation();
    if (inPlan) {
      removeFromPlan(idea.id);
    } else {
      addToPlan({
        key: idea.id,
        instrumentName: idea.name,
        category: idea.category,
        ticker: idea.ticker,
        suggestedMonthlyAmount: idea.suggestedAmount,
        source: "discover",
      });
    }
  }

  return (
    <Link href={`/asset-intelligence/${encodeURIComponent(idea.slug)}`} className="block">
      <Card className="transition hover:border-primary/40 hover:shadow-md">
        <CardContent className="relative grid gap-5 p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)_minmax(0,.8fr)_auto] lg:items-center">
          {/* Left: logo + name + 3 checkmark bullets */}
          <div className="flex min-w-0 gap-4">
            <InvestmentLogo name={idea.name} category={idea.category} ticker={idea.ticker} size="lg" />
            <div className="min-w-0">
              <h3 className="line-clamp-1 text-lg font-semibold text-foreground">{idea.name}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{idea.category}{idea.ticker ? ` · ${idea.ticker}` : ""}</p>
              <ul className="mt-2 space-y-1">
                {idea.bullets.slice(0, 3).map((bullet) => (
                  <li key={bullet} className="flex items-start gap-1.5 text-sm text-foreground/85">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive-foreground" />
                    <span className="line-clamp-1">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Risk pill + Expected return stacked underneath */}
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${riskPillClass(idea.risk)}`}>
              <Shield className="h-3 w-3" />
              {idea.risk} Risk
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Expected Return</p>
              <p className="text-[15px] font-semibold text-foreground">{idea.expectedReturn}</p>
            </div>
            {idea.livePrice ? (
              <p className="text-[11px] text-muted-foreground">{priceLabel(idea)} <span className="font-semibold text-foreground">{formatPrice(idea.livePrice)}</span></p>
            ) : null}
          </div>

          {/* Suggested SIP — its own column */}
          <div className="text-left lg:text-center">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{idea.category.toLowerCase().includes("stock") || idea.category === "Crypto" ? "Suggested allocation" : "Suggested SIP"}</p>
            <p className="mt-0.5 text-[15px] font-semibold text-foreground">{idea.suggestedAmount ? `${inr(idea.suggestedAmount)} / month` : "Review first"}</p>
          </div>

          {/* Right: save bookmark + View Details */}
          <div className="flex items-center gap-3 justify-self-end">
            <button
              type="button"
              onClick={toggleSave}
              aria-label={inPlan ? "Remove from plan" : "Save to plan"}
              aria-pressed={inPlan}
              className={cn(
                "hidden h-9 w-9 items-center justify-center rounded-full border transition lg:inline-flex",
                inPlan
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
              )}
            >
              <Bookmark className={cn("h-4 w-4", inPlan && "fill-current")} />
            </button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">View Details</Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function riskPillClass(risk: string) {
  if (risk === "Low") return "bg-positive-soft text-positive-foreground";
  if (risk === "High") return "bg-negative-soft text-negative-foreground";
  return "bg-warning-soft text-warning-foreground";
}

function priceLabel(idea: InvestmentIdea) {
  const cat = idea.category.toLowerCase();
  if (cat.includes("fund") || cat.includes("etf")) return "NAV";
  if (cat.includes("crypto")) return "Price";
  return "LTP";
}

function formatPrice(price: { value: number; unit: string }) {
  if (!price.value) return "—";
  const unit = price.unit || "";
  if (price.value >= 1000) return `${unit}${price.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return `${unit}${price.value.toFixed(2)}`;
}

function InviteWidget() {
  return (
    <div className="rounded-2xl border border-positive-soft bg-positive-soft/60 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-positive-soft">
          <UserPlus className="h-4 w-4 text-positive-foreground" />
        </span>
        <p className="text-sm font-semibold text-foreground">Invite a friend</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Help your friends get started with their financial plan.</p>
      <Link href="/chat" className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline">Learn more →</Link>
    </div>
  );
}

// ----- mapping helpers (carried over from previous version, kept functional) -----

function mapRecommendation(rec: AdvancedRecommendation, profile: OnboardingProfile | null): InvestmentIdea {
  const risk = normalizeRisk(rec.riskLevel);
  const category = friendlyCategory(rec.assetType || rec.assetClass || rec.recommendationType);
  const why = rec.explanation_cards?.[0]?.answer || rec.explanationCards?.[0]?.summary || rec.userSpecificReasoning || rec.whyThisMatters || rec.recommendationTitle;
  const support = rec.explanation_cards?.find((item) => /support|promising/i.test(item.question))?.answer || rec.supportingSignals?.[0]?.summary || rec.keyTrigger;
  const name = rec.instrumentName;
  return {
    id: `rec-${rec.recommendationKey || rec.id || name}`,
    slug: slugify(`rec-${rec.recommendationKey || rec.id || name}`),
    name,
    ticker: rec.ticker || "",
    category,
    tab: "Recommended For You",
    risk,
    action: friendlyAction(rec.action),
    expectedReturn: recommendationReturn(rec),
    suggestedAmount: rec.suggestedMonthlyAmount || suggestedAmount(profile, risk, category),
    bullets: bulletsForRec(rec, why, support).slice(0, 3),
    summary: concise(why || "This idea comes from your current action plan."),
    whyNow: clean(rec.explanation_cards?.find((item) => /now|time/i.test(item.question))?.answer || rec.currentMarketReasoning || rec.whyNow || "A gradual approach is suitable right now."),
    risks: [rec.primaryRisk, rec.whatCanGoWrong, rec.riskExplanation].filter(Boolean).map(clean),
    advanced: [
      clean(rec.advanced_analysis || rec.advancedAnalysis || rec.full_research_summary || rec.fullResearchSummary || ""),
      clean(rec.invalidationTrigger || rec.exitOrRebalanceCondition || "Review this if supporting information weakens."),
    ].filter(Boolean),
    livePrice: null,
    buyRange: rec.buyRange || "",
    sellRange: rec.sellRange || "",
    raw: rec,
  };
}

function bulletsForRec(rec: AdvancedRecommendation, why?: string, support?: string): string[] {
  const cat = (rec.assetType || rec.assetClass || "").toLowerCase();
  const out: string[] = [];
  // Prefer short, generic, useful phrases — like reference image
  if (cat.includes("index")) out.push("Low cost");
  if (cat.includes("index") || cat.includes("fund")) out.push("Diversified across many companies");
  if (cat.includes("debt") || cat.includes("bond")) out.push("Stable returns");
  if (cat.includes("gold") || cat.includes("sgb")) out.push("Hedge against inflation");
  if (cat.includes("crypto")) out.push("Highly volatile — keep allocation small");
  out.push("Ideal for long-term wealth creation");
  // Fill from descriptive text if needed
  for (const value of [why, support, rec.goalImpactSummary]) {
    if (out.length >= 3) break;
    const trimmed = brief(value);
    if (trimmed) out.push(trimmed);
  }
  // Dedupe and clip
  return Array.from(new Set(out));
}

function mapAsset(asset: AssetIntelligence, profile: OnboardingProfile | null): InvestmentIdea {
  const risk = normalizeRisk(asset.risk?.riskCategory || (asset.assetType.toLowerCase().includes("crypto") ? "High" : "Medium"));
  const category = friendlyCategory(asset.normalizedAssetClass || asset.assetType || asset.category);
  const evidence = Math.max(asset.confidenceScore || 0, asset.alpha?.evidenceScore || 0, asset.crypto?.evidenceScore || 0);
  const name = asset.assetName || "Investment idea";
  const latest = asset.technical?.latestPrice;
  return {
    id: `asset-${name}-${asset.ticker}`,
    slug: slugify(`asset-${name}-${asset.ticker}`),
    name,
    ticker: asset.ticker || "",
    category,
    tab: tabFor(category, risk, evidence, asset.alpha?.bucket),
    risk,
    action: friendlyAction(asset.alpha?.suggestedAction || asset.crypto?.recommendedAction || "Consider"),
    expectedReturn: expectedReturn(category, risk),
    suggestedAmount: suggestedAmount(profile, risk, category),
    bullets: bulletsForAsset(asset).slice(0, 3),
    summary: concise(asset.summary || asset.why_this_matters || "This idea is being reviewed using available investment data."),
    whyNow: clean(asset.why_now || asset.whyNow || asset.alpha?.keySignal || "Limited timing information."),
    risks: [asset.riskNotes, asset.risk?.riskNotes, asset.crypto?.riskWarning].filter(Boolean).map(clean),
    advanced: [
      clean(asset.technical?.breakoutStatus ? `Price trend: ${asset.technical.breakoutStatus}.` : ""),
      clean(asset.fundamental?.earningsMomentum ? `Business trend: ${asset.fundamental.earningsMomentum}.` : ""),
      clean(asset.invalidation_trigger || asset.invalidationTrigger || "Review this if supporting information weakens."),
    ].filter(Boolean),
    livePrice: latest ? { value: latest, unit: priceUnitFor(category) } : null,
    buyRange: asset.technical?.buyRange || "",
    sellRange: asset.technical?.reviewZone || asset.technical?.stopLossReference || "",
    raw: asset,
  };
}

function bulletsForAsset(asset: AssetIntelligence): string[] {
  const cat = (asset.normalizedAssetClass || asset.assetType || asset.category || "").toLowerCase();
  const out: string[] = [];
  if (cat.includes("debt") || cat.includes("bond")) out.push("Stable returns");
  if (cat.includes("gold") || cat.includes("sgb")) out.push("Hedge against inflation");
  if (cat.includes("index")) out.push("Low cost");
  if (cat.includes("etf") || cat.includes("index")) out.push("Diversified across many companies");
  if (cat.includes("crypto")) out.push("Highly volatile");
  out.push("Ideal for long-term wealth creation");
  for (const value of [asset.why_this_matters || asset.whyThisMatters, asset.suitable_for || asset.suitableFor]) {
    if (out.length >= 3) break;
    const trimmed = brief(value);
    if (trimmed) out.push(trimmed);
  }
  return Array.from(new Set(out));
}

function priceUnitFor(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes("crypto")) return "$";
  return "₹";
}

function mapAlpha(alpha: AlphaOpportunity, profile: OnboardingProfile | null): InvestmentIdea {
  const risk = normalizeRisk(alpha.riskLabel);
  return {
    id: `alpha-${alpha.assetName}-${alpha.ticker}`,
    slug: slugify(`alpha-${alpha.assetName}-${alpha.ticker}`),
    name: alpha.assetName,
    ticker: alpha.ticker || "",
    category: friendlyCategory(alpha.assetType),
    tab: alpha.bucket === "underdog" || alpha.bucket === "contrarian" ? "Under The Radar" : "Trending",
    risk,
    action: friendlyAction(alpha.suggestedAction),
    expectedReturn: risk === "High" ? "Wide range" : "Estimate pending",
    suggestedAmount: suggestedAmount(profile, risk, alpha.assetType),
    bullets: [alpha.nonObviousReason, alpha.keySignal, alpha.supportingSignals[0]].filter(Boolean).map((value) => brief(value)),
    summary: concise(alpha.nonObviousReason),
    whyNow: clean(alpha.keySignal),
    risks: [alpha.riskLabel, ...alpha.conflictingSignals].filter(Boolean).map(clean),
    advanced: [alpha.invalidationTrigger, ...alpha.supportingSignals].filter(Boolean).map(clean),
    livePrice: null,
    raw: alpha,
  };
}

function mapCrypto(crypto: CryptoOpportunity, profile: OnboardingProfile | null): InvestmentIdea {
  return {
    id: `crypto-${crypto.assetName}-${crypto.symbol}`,
    slug: slugify(`crypto-${crypto.assetName}-${crypto.symbol}`),
    name: crypto.assetName,
    ticker: crypto.symbol || "",
    category: "Crypto",
    tab: "High Growth",
    risk: "High",
    action: friendlyAction(crypto.recommendedAction),
    expectedReturn: "Wide range",
    suggestedAmount: suggestedAmount(profile, "High", "Crypto"),
    bullets: ["Highly volatile", `Keep within ${crypto.allocationCap}% of investments`, "Only for money you can risk"],
    summary: concise(crypto.narrative),
    whyNow: clean(crypto.narrative),
    risks: [crypto.riskWarning, "Digital assets can lose value quickly."].map(clean),
    advanced: [`Liquidity score: ${crypto.liquidityScore}%.`, `Narrative strength: ${crypto.narrativeStrength}%.`],
    livePrice: null,
    raw: crypto,
  };
}

function recommendationReturn(rec: AdvancedRecommendation) {
  if (rec.expectedReturn?.label) return rec.expectedReturn.label.replace(/CAGR/gi, "p.a.");
  if (rec.expectedReturn?.cagrRange) return `${rec.expectedReturn.cagrRange} p.a.`;
  if (typeof rec.expectedReturn?.expectedCagr === "number") return `${rec.expectedReturn.expectedCagr}% p.a.`;
  if (rec.expectedReturnRange) return rec.expectedReturnRange;
  return expectedReturn(friendlyCategory(rec.assetType || rec.assetClass || ""), rec.riskLevel);
}

function tabFor(category: string, risk: string, evidence: number, bucket?: string): InvestmentIdea["tab"] {
  const text = `${category} ${bucket}`.toLowerCase();
  if (text.includes("gold") || text.includes("debt") || text.includes("cash") || risk === "Low") return "Safe Options";
  if (risk === "High") return "High Growth";
  if (text.includes("underdog") || text.includes("contrarian")) return "Under The Radar";
  if (evidence >= 72) return "Recommended For You";
  return "Trending";
}

function friendlyCategory(value: string) {
  const text = value.toLowerCase();
  if (text.includes("mutual") || text.includes("fund")) return text.includes("debt") ? "Debt Fund" : "Mutual Fund";
  if (text.includes("etf")) return "ETF";
  if (text.includes("crypto")) return "Crypto";
  if (text.includes("gold")) return "Gold";
  if (text.includes("stock") || text.includes("equity")) return "Stock";
  return value || "Investment";
}

function expectedReturn(category: string, risk: string) {
  const text = category.toLowerCase();
  if (text.includes("debt") || text.includes("cash")) return "5-7% p.a.";
  if (text.includes("gold")) return "5-8% p.a.";
  if (risk === "High") return "Wide range";
  return "8-12% p.a.";
}

function suggestedAmount(profile: OnboardingProfile | null, risk: string, category: string) {
  const surplus = Number(profile?.monthlyCashInflow || 0) - Number(profile?.monthlyExpenses || 0) - Number(profile?.emi || 0);
  const base = Math.max(Math.round((surplus || 20000) * (risk === "High" || category === "Crypto" ? 0.08 : risk === "Low" ? 0.18 : 0.14) / 500) * 500, 0);
  return base;
}

function normalizeRisk(value: string) {
  const text = value.toLowerCase();
  if (text.includes("low")) return "Low";
  if (text.includes("high") || text.includes("extreme")) return "High";
  return "Medium";
}

function friendlyAction(value: string) {
  const text = value.toLowerCase();
  if (text.includes("watch")) return "Watch first";
  if (text.includes("avoid")) return "Avoid for now";
  return "Consider gradually";
}

function clean(value?: string) {
  const text = String(value || "").replace(/\s+/g, " ").replace(/\.\.\.+/g, ".").trim();
  if (!text || text === "undefined" || text === "null") return "";
  return text.length > 190 ? `${text.slice(0, 180).replace(/\s+\S*$/, "")}.` : /[.!?]$/.test(text) ? text : `${text}.`;
}

// Tighten verbose backend text into a short bullet phrase
function brief(value?: string, maxChars = 60): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text === "undefined" || text === "null") return "";
  // Take the first sentence
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0];
  const trimmed = firstSentence.replace(/[.!?]+$/, "").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars).replace(/\s+\S*$/, "") + "…";
}

// Convert a longer description into a concise summary (one tight sentence, ~140 chars max)
function concise(value?: string): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0];
  if (firstSentence.length <= 140) return firstSentence;
  return firstSentence.slice(0, 138).replace(/\s+\S*$/, "") + "…";
}

function dedupe(items: InvestmentIdea[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.name}-${item.ticker}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreIdea(idea: InvestmentIdea) {
  return (idea.tab === "Recommended For You" ? 80 : idea.tab === "Safe Options" ? 70 : idea.tab === "Trending" ? 64 : idea.tab === "High Growth" ? 58 : 55) + (idea.risk === "Low" ? 6 : idea.risk === "High" ? -3 : 2);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
