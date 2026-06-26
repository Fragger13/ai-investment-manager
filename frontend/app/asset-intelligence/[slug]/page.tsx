"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, Coins, Gauge, Landmark, Layers, Lock, MessagesSquare, PieChart, ShieldCheck, Share2, Sparkles, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { InvestmentLogo } from "@/components/investment-logo";
import { TakeActionDialog } from "@/components/take-action-dialog";
import { usePlanActionsStore } from "@/store/plan-actions-store";
import { useAuthStore } from "@/store/auth-store";
import { inr } from "@/lib/utils";
import { useEnsureProfile } from "@/lib/use-ensure-profile";
import type { CommunitySentiment } from "@/types";
import type { InvestmentIdea } from "../page";

export default function InvestmentDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = decodeURIComponent(params?.slug || "");
  const profile = useEnsureProfile();
  const [idea, setIdea] = useState<InvestmentIdea | null>(null);
  const [allIdeas, setAllIdeas] = useState<InvestmentIdea[]>([]);
  const [goalImpactOpen, setGoalImpactOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const goalImpactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem("aim-discover-ideas");
      const ideas: InvestmentIdea[] = raw ? JSON.parse(raw) : [];
      setAllIdeas(ideas);
      const match = ideas.find((entry) => entry.slug === slug);
      setIdea(match || null);
    } catch {
      setIdea(null);
    }
  }, [slug]);

  const addToPlan = usePlanActionsStore((state) => state.addToPlan);
  const removeFromPlan = usePlanActionsStore((state) => state.removeFromPlan);
  const inPlan = usePlanActionsStore((state) => idea ? state.planItems.some((entry) => entry.key === idea.id) : false);

  const tags = useMemo(() => idea ? deriveTags(idea) : [], [idea]);
  const matchPoints = useMemo(() => idea ? deriveMatchPoints(idea) : [], [idea]);
  const similarIdeas = useMemo(() => {
    if (!idea) return [];
    return allIdeas
      .filter((entry) => entry.slug !== idea.slug && entry.category === idea.category)
      .slice(0, 5);
  }, [idea, allIdeas]);

  function scrollToGoalImpact() {
    setGoalImpactOpen(true);
    goalImpactRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (!idea) {
    return (
      <AppShell>
        <div className="mb-6">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Discover
          </button>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">We couldn&apos;t load this investment idea directly. Open Discover and click the card again.</p>
            <Button asChild className="mt-4"><Link href="/asset-intelligence">Back to Discover</Link></Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  function togglePlan() {
    if (!idea) return;
    if (inPlan) removeFromPlan(idea.id);
    else addToPlan({
      key: idea.id,
      instrumentName: idea.name,
      category: idea.category,
      ticker: idea.ticker,
      suggestedMonthlyAmount: idea.suggestedAmount,
      source: "discover",
    });
  }

  return (
    <AppShell sidebarExtra={<DetailSidebarWidget />}>
      <div className="mb-5 flex items-center justify-between">
        <Link href="/asset-intelligence" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Discover
        </Link>
        <Button variant="outline" size="sm"><Share2 className="h-4 w-4" /> Share</Button>
      </div>

      <Card className="mb-6">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex items-start gap-4">
            <InvestmentLogo name={idea.name} category={idea.category} ticker={idea.ticker} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">{idea.name}</h1>
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{idea.category}</span>
                {idea.ticker ? <><span>·</span><span>{idea.ticker}</span></> : null}
                <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-2.5 py-0.5 text-xs font-semibold text-positive-foreground">
                  <BadgeCheck className="h-3 w-3" /> High Conviction
                </span>
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground">{idea.summary}</p>
              {idea.whyNow ? <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">{idea.whyNow}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-foreground">
                    <CheckCircle2 className="h-3 w-3 text-info-foreground" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Why this matches you — top-right per reference */}
          <div className="min-w-0 rounded-2xl bg-positive-soft/50 p-5">
            <div className="flex items-center gap-2 text-positive-foreground">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm font-semibold">Why this matches you</p>
            </div>
            <ul className="mt-3 space-y-2">
              {matchPoints.slice(0, 3).map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm leading-6 text-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-positive-foreground" />
                  <span className="min-w-0 break-words">{point}</span>
                </li>
              ))}
            </ul>
            <button onClick={scrollToGoalImpact} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View goal impact <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Key facts — community pulse + return + SIP */}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <CommunityPulse community={idea.community} />
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <p className="text-sm font-semibold text-foreground">Expected return</p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-positive-foreground">{idea.expectedReturn}</p>
            <p className="mt-2 text-[13px] text-muted-foreground">Based on historical data</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <p className="text-sm font-semibold text-foreground">Suggested SIP</p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">{idea.suggestedAmount ? `${inr(idea.suggestedAmount)} / month` : "Review first"}</p>
            <p className="mt-2 text-[13px] text-muted-foreground">Start with as low as ₹500/month</p>
          </CardContent>
        </Card>
      </div>

      {/* Live price + buy/sell ranges where we have them */}
      {(idea.livePrice || idea.buyRange || idea.sellRange) ? (
        <Card className="mb-5 border-border">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
            <PriceTile label="Live price" value={idea.livePrice ? formatPrice(idea.livePrice) : "—"} sub={idea.livePrice ? "Latest market price" : "Refresh research to fetch"} />
            <PriceTile label="Suggested buy range" value={idea.buyRange || "—"} sub={idea.buyRange ? "Recent technical zone" : "Limited data"} />
            <PriceTile label="Review / Sell" value={idea.sellRange || "—"} sub={idea.sellRange ? "Trim or review here" : "Limited data"} />
          </CardContent>
        </Card>
      ) : null}

      {/* Goal impact banner — blue band per reference */}
      <Card ref={goalImpactRef} className={`mb-5 border-info-soft bg-info-soft/40 ${goalImpactOpen ? "ring-2 ring-primary/30" : ""}`}>
        <CardContent className="grid gap-5 p-6 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <div className="flex items-center gap-2 text-info-foreground">
              <BadgeCheck className="h-4 w-4" />
              <p className="text-lg font-bold tracking-tight text-foreground">If you start this SIP today</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">The projected effect on your {profile?.goals?.[0]?.type || "primary"} goal, based on your current pace.</p>
            {goalImpactOpen ? (
              <Link href="/goals" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Open Goals page <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
          <GoalImpactGrid idea={idea} profile={profile} />
        </CardContent>
      </Card>

      {/* Keep in mind */}
      <div className="mb-5 rounded-2xl border border-warning/30 bg-warning-soft/60 p-4">
        <p className="text-sm font-semibold text-warning-foreground">Keep in mind</p>
        <p className="mt-1 text-sm text-foreground">Past performance is not a guarantee of future returns. Investments in this category are subject to market risks. Please read all scheme-related documents carefully before investing.</p>
      </div>

      {/* Other details + Ready to invest */}
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardContent className="p-6">
            <p className="text-lg font-bold tracking-tight text-foreground">Other details</p>
            <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <DetailRow icon={Layers} label="Fund type" value={idea.category} />
              <DetailRow icon={Landmark} label="Fund house" value={fundHouse(idea.name)} />
              <DetailRow icon={Gauge} label="Benchmark" value={benchmarkFor(idea)} />
              <DetailRow icon={Coins} label="Minimum investment" value="₹500" />
              <DetailRow icon={PieChart} label="Expense ratio" value="0.15% (Very Low)" />
              <DetailRow icon={Lock} label="Lock-in period" value="No Lock-in" />
            </div>

            {/* Risk level + risks — relocated here to keep the top of the page clean */}
            <div className="mt-5 border-t border-border pt-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Risk level — {idea.risk}</p>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{riskBlurb(idea.risk)}</p>
              {idea.risks.length ? (
                <>
                  <p className="mt-4 text-sm font-semibold text-foreground">Risks to be aware of</p>
                  <ul className="mt-2 space-y-2">
                    {idea.risks.slice(0, 4).map((risk) => (
                      <li key={risk} className="flex items-start gap-2 text-[13px] text-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-lg font-bold tracking-tight text-foreground">Ready to invest?</p>
            <p className="mt-1 text-sm text-muted-foreground">Add this fund to your plan, then choose a monthly SIP or a one-time lump sum when you take action.</p>

            <div className="mt-4 rounded-xl bg-surface-soft p-4">
              <p className="text-[13px] uppercase tracking-wide text-muted-foreground">Suggested SIP to start</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{idea.suggestedAmount ? `${inr(idea.suggestedAmount)} / mo` : "Set your amount"}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Or invest a lump sum — pick in the next step.</p>
            </div>

            <div className="mt-4 space-y-2.5">
              <Button className="w-full" onClick={togglePlan}>
                {inPlan ? (<><CheckCircle2 className="h-4 w-4" /> Added to Plan</>) : (<>Add to Plan <ArrowRight className="h-4 w-4" /></>)}
              </Button>
              <TakeActionDialog
                payload={{
                  key: idea.id,
                  instrumentName: idea.name,
                  category: idea.category,
                  ticker: idea.ticker,
                  suggestedMonthlyAmount: idea.suggestedAmount,
                  actionLabel: idea.action,
                  reason: idea.summary,
                  expectedReturn: idea.expectedReturn,
                  risk: idea.risk,
                  livePrice: idea.livePrice?.value,
                  kind: "fund",
                }}
                trigger={<Button variant="outline" className="w-full">Take Action Now <TrendingUp className="h-4 w-4" /></Button>}
              />
              <button
                onClick={() => setCompareOpen(true)}
                disabled={!similarIdeas.length}
                className="block w-full rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium text-foreground transition hover:bg-surface-hover disabled:opacity-50"
              >
                Compare with other funds
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-h-[88vh] w-[min(820px,96vw)] overflow-y-auto p-0">
          <div className="border-b border-border px-6 py-5 pr-12">
            <DialogTitle className="text-lg font-semibold text-foreground">Compare options</DialogTitle>
            <p className="mt-1 text-[13px] text-muted-foreground">Similar {idea.category.toLowerCase()} ideas matched to your profile.</p>
          </div>
          <div className="space-y-3 p-5">
            {/* Current idea row, marked */}
            <CompareRow idea={idea} highlight />
            {similarIdeas.map((other) => <CompareRow key={other.id} idea={other} />)}
            {!similarIdeas.length ? (
              <p className="rounded-lg bg-surface-soft p-4 text-sm text-muted-foreground">No other ideas in this category right now. Open Discover to see all categories.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function CompareRow({ idea, highlight }: { idea: InvestmentIdea; highlight?: boolean }) {
  return (
    <div className={`grid items-center gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_110px_120px_120px_auto] ${highlight ? "border-primary bg-accent" : "border-border"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <InvestmentLogo name={idea.name} category={idea.category} ticker={idea.ticker} size="md" />
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm font-semibold text-foreground">{idea.name}{highlight ? <span className="ml-2 text-xs font-normal text-primary">(this idea)</span> : null}</p>
          <p className="text-[13px] text-muted-foreground">{idea.category}</p>
        </div>
      </div>
      <Badge tone={riskTone(idea.risk)}>{idea.risk}</Badge>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Return</p>
        <p className="text-sm font-semibold text-foreground">{idea.expectedReturn}</p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">SIP</p>
        <p className="text-sm font-semibold text-foreground">{idea.suggestedAmount ? `${inr(idea.suggestedAmount)}/mo` : "—"}</p>
      </div>
      <Link href={`/asset-intelligence/${encodeURIComponent(idea.slug)}`} className="text-sm font-medium text-primary hover:underline justify-self-end">
        Open <ArrowRight className="inline h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function DetailSidebarWidget() {
  return (
    <div className="rounded-2xl border border-border bg-surface-soft p-4">
      <p className="text-sm font-semibold text-foreground">Small steps today</p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Big freedom tomorrow. Build your plan one investment at a time.</p>
    </div>
  );
}

function Impact({ label, value, tone }: { label: string; value: string; tone: "positive" | "info" | "neutral" }) {
  const colors = {
    positive: "text-positive-foreground",
    info: "text-info-foreground",
    neutral: "text-foreground",
  };
  return (
    <div className="rounded-xl bg-surface p-3 text-center">
      <p className={`text-xl font-semibold ${colors[tone]}`}>{value}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-soft text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <p className="truncate font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function PriceTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-surface-soft p-4">
      <p className="text-[13px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p>
    </div>
  );
}

// Compact "What people are saying" card — sits in the key-facts row in place of
// the old Risk card. Always renders (with a graceful empty state) so the trust
// signal is a consistent fixture. Fed by the Reddit research layer.
function CommunityPulse({ community }: { community?: CommunitySentiment | null }) {
  const has = Boolean(community && community.mentionCount);
  const tone =
    community?.sentiment === "positive" ? { label: "Mostly positive", dot: "bg-positive", text: "text-positive-foreground", soft: "bg-positive-soft" }
    : community?.sentiment === "negative" ? { label: "Mostly negative", dot: "bg-negative", text: "text-negative-foreground", soft: "bg-negative-soft" }
    : community?.sentiment === "mixed" ? { label: "Mixed views", dot: "bg-warning", text: "text-warning-foreground", soft: "bg-warning-soft" }
    : { label: "Neutral", dot: "bg-info", text: "text-info-foreground", soft: "bg-info-soft" };
  const subs = (community?.subreddits || []).slice(0, 2).map((s) => `r/${s}`).join(", ");
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MessagesSquare className="h-4 w-4" />
          <p className="text-sm font-semibold text-foreground">What people are saying</p>
        </div>
        {has && community ? (
          <>
            <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full ${tone.soft} px-2.5 py-1 text-xs font-semibold ${tone.text}`}>
              <span className={`h-2 w-2 rounded-full ${tone.dot}`} /> {tone.label}
            </span>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {community.mentionCount} recent mention{community.mentionCount === 1 ? "" : "s"}{subs ? ` · ${subs}` : ""}. Context from Reddit — not advice.
            </p>
          </>
        ) : (
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">No notable community chatter on this one yet. We&apos;ll surface Reddit sentiment here when it appears.</p>
        )}
      </CardContent>
    </Card>
  );
}

function riskBlurb(risk: string) {
  if (risk === "Low") return "Limited short-term drawdown; suitable for stable goals.";
  if (risk === "High") return "Can fall 30%+ in bad markets — only invest money you can leave for years.";
  return "Can fall 15–20% in bad markets in the short term.";
}

function formatPrice(price: { value: number; unit: string }) {
  if (!price.value) return "—";
  const unit = price.unit || "";
  if (price.value >= 1000) return `${unit}${price.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return `${unit}${price.value.toFixed(2)}`;
}

function fundHouse(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("sbi")) return "SBI Mutual Fund";
  if (lower.includes("hdfc")) return "HDFC Mutual Fund";
  if (lower.includes("icici")) return "ICICI Prudential";
  if (lower.includes("axis")) return "Axis Mutual Fund";
  if (lower.includes("kotak")) return "Kotak Mahindra Mutual Fund";
  if (lower.includes("nippon")) return "Nippon India Mutual Fund";
  if (lower.includes("mirae")) return "Mirae Asset";
  if (lower.includes("uti")) return "UTI Mutual Fund";
  if (lower.includes("tata")) return "Tata Mutual Fund";
  if (lower.includes("ppfas") || lower.includes("parag parikh")) return "PPFAS Mutual Fund";
  return "—";
}

function benchmarkFor(idea: InvestmentIdea) {
  const cat = idea.category.toLowerCase();
  if (cat.includes("index") || idea.name.toLowerCase().includes("nifty 50")) return "Nifty 50 TRI";
  if (idea.name.toLowerCase().includes("nifty next")) return "Nifty Next 50 TRI";
  if (cat.includes("debt") || cat.includes("bond")) return "Crisil Bond Index";
  if (cat.includes("gold")) return "Gold Spot Price";
  if (cat.includes("etf")) return "Underlying Index";
  return "—";
}

function GoalImpactGrid({ idea, profile }: { idea: InvestmentIdea; profile: ReturnType<typeof useAuthStore.getState>["profile"] }) {
  const monthly = idea.suggestedAmount || 0;
  const horizonYears = idea.risk === "Low" ? 3 : idea.risk === "High" ? 10 : 7;
  const cagr = idea.risk === "Low" ? 0.06 : idea.risk === "High" ? 0.13 : 0.10;
  const months = horizonYears * 12;
  const monthlyRate = cagr / 12;
  const futureValue = monthly > 0 && monthlyRate > 0
    ? Math.round(monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate))
    : monthly * months;
  const topGoal = profile?.goals?.[0];
  const goalName = topGoal ? (topGoal.type === "Other" ? topGoal.customName : topGoal.type) : "your top goal";
  const chanceLift = idea.risk === "Low" ? 8 : idea.risk === "High" ? 18 : 12;
  const monthsCloser = idea.risk === "Low" ? 1 : idea.risk === "High" ? 4 : 2;

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <Impact label={`Higher chance of ${goalName}`} value={`+${chanceLift}%`} tone="positive" />
      <Impact label="Goal completion sooner" value={`-${monthsCloser} months`} tone="info" />
      <Impact label={`In ${horizonYears} yrs at suggested SIP`} value={futureValue > 0 ? `${largeInr(futureValue)}` : "—"} tone="neutral" />
    </div>
  );
}

function largeInr(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
  return `₹${value}`;
}

function deriveTags(idea: InvestmentIdea): string[] {
  const base = [idea.risk + " Risk", idea.category];
  if (idea.action.toLowerCase().includes("consider")) base.push("Recommended");
  if (idea.expectedReturn.toLowerCase().includes("wide")) base.push("High Growth");
  else if (idea.risk === "Low") base.push("Stability");
  if (idea.tab === "Recommended For You") base.push("Fits your profile");
  return base.slice(0, 5);
}

function deriveMatchPoints(idea: InvestmentIdea): string[] {
  // The card bullets are truncated to ~60 chars for the row layout; here we
  // want fuller phrases since the panel can wrap. Build a fresh list from
  // first principles.
  const points: string[] = [];
  if (idea.tab === "Recommended For You") points.push("Aligns with your saved goals and risk profile.");
  if (idea.risk === "Low") points.push("Good fit for stable, near-term needs.");
  else if (idea.risk === "High") points.push("Suits your appetite for higher growth.");
  else points.push("Balanced fit for medium-term goals.");
  // Add a couple of fund-specific bullets, untruncated.
  for (const bullet of idea.bullets) {
    const trimmed = bullet.replace(/…$/, "").trim();
    if (trimmed && !points.includes(trimmed)) points.push(trimmed);
    if (points.length >= 3) break;
  }
  return points.slice(0, 3);
}

function riskTone(risk: string): "good" | "warn" | "danger" | "neutral" {
  if (risk === "Low") return "good";
  if (risk === "High") return "danger";
  if (risk === "Medium") return "warn";
  return "neutral";
}
