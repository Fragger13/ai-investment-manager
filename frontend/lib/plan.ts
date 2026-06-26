// Shared action-plan logic.
//
// This is the single source of truth for turning the advanced recommendation
// engine + the dashboard's behavioural signals into a ranked, layered action
// plan. Both the Plan page (/recommendations) and the Dashboard preview import
// from here so the "Do first" items always match across the app — previously
// the dashboard sliced a different, unranked list and showed different actions.

import { AdvancedRecommendation, CommunitySentiment, DashboardData, FundFactorInsights, GoalFundingStatus } from "@/types";
import { inr } from "@/lib/utils";

export const tabs = ["Must Do", "Consider", "Explore"] as const;
export const TAB_LABELS: Record<(typeof tabs)[number], string> = {
  "Must Do": "Do first",
  Consider: "Next up",
  Explore: "Worth a look",
};
export type TabName = (typeof tabs)[number];

// Unified action-plan item — covers fund recommendations AND non-investment actions
export type ActionItem = {
  key: string;
  kind: "recommendation" | "action";
  actionKind: "fund" | "lump_sum" | "habit" | "debt" | "review";
  title: string;
  /** Original instrument name from the backend rec. Display uses `title`, but
   *  the icon resolver receives this too so AMC keywords aren't lost when the
   *  title is simplified (e.g. "Increase Nifty Index SIP"). */
  instrumentName?: string;
  reason: string;
  impact: "High" | "Medium" | "Low";
  confidence: number;
  category: string; // shown under title and used for the logo
  ticker: string;
  suggestedMonthlyAmount: number;
  /** What the goal/engine ideally wants per month, before this-month budget
   *  calibration. When it exceeds suggestedMonthlyAmount we surface the gap. */
  idealMonthlyAmount?: number;
  expectedReturn?: string;
  risk?: string;
  bucket: TabName;
  goalName?: string;
  ctaLabel: string;
  explanationCards: { title: string; summary: string }[];
  isFundPick?: boolean;
  factorDrivers?: string[];
  factorInsights?: FundFactorInsights;
  goalFunding?: GoalFundingStatus;
  community?: CommunitySentiment;
};

// ---------- Merge logic: fund recommendations + non-investment actions ----------

export function mergeIntoActionItems(recs: AdvancedRecommendation[], dashboard: DashboardData): ActionItem[] {
  // 1) Non-investment / behavioral actions derived from the dashboard
  const synthesized = synthesizeActions(dashboard);
  // 2) Fund recommendations from the advanced engine
  const recItems = recs.map(recToItem);

  // A goal-linked fund should surface the goal's real monthly need (what the
  // Goals tab shows), not the fund's own "fully fund it" figure — otherwise the
  // same goal displays two different numbers across tabs.
  const goalNeed = new Map<string, number>();
  dashboard.goals.forEach((goal) => {
    if (goal.name) goalNeed.set(goal.name.toLowerCase(), goal.requiredMonthlyInvestment || 0);
  });
  recItems.forEach((item) => {
    const need = item.goalName ? goalNeed.get(item.goalName.toLowerCase()) : undefined;
    if (need && need > 0) item.suggestedMonthlyAmount = need;
  });

  // Drop the abstract "Catch up on {goal}" nudge when a concrete recommendation
  // already funds that goal — the fund IS the catch-up action, so showing both
  // is redundant and double-counts the goal in the budget. Keep the nudge only
  // as a fallback when no recommendation targets that off-track goal.
  const recGoalNames = new Set(
    recItems.filter((item) => item.goalName).map((item) => item.goalName!.toLowerCase()),
  );
  const dedupedSynth = synthesized.filter(
    (item) => !(item.key.startsWith("action-goal-") && item.goalName && recGoalNames.has(item.goalName.toLowerCase())),
  );

  // Deduplicate by category-y key (e.g., emergency fund coming both from recs and synth)
  const items = [...dedupedSynth, ...recItems];
  const seen = new Set<string>();
  return items.filter((item) => {
    const dedup = dedupKey(item);
    if (seen.has(dedup)) return false;
    seen.add(dedup);
    return true;
  });
}

function synthesizeActions(dashboard: DashboardData): ActionItem[] {
  const out: ActionItem[] = [];

  // Emergency fund
  if (dashboard.health.emergencyFundMonths < 6) {
    const monthsBehind = Math.max(0, 6 - dashboard.health.emergencyFundMonths);
    out.push({
      key: "action-emergency-fund",
      kind: "action",
      actionKind: "fund",
      title: "Build Emergency Fund",
      reason: `${monthsBehind.toFixed(0)}-month gap to reach 6 months of expenses.`,
      impact: dashboard.health.emergencyFundMonths < 3 ? "High" : "Medium",
      confidence: 92,
      category: "Emergency fund",
      ticker: "",
      suggestedMonthlyAmount: Math.max(Math.round((dashboard.summary.investableSurplus || 20000) * 0.4 / 500) * 500, 2000),
      bucket: "Must Do",
      ctaLabel: "Start transfer",
      explanationCards: [
        { title: "Why this fits you", summary: "Emergency money protects you from job loss, medical costs, or sudden expenses." },
        { title: "What supports it", summary: "Your current cash buffer is below the typical 6-month comfort level." },
        { title: "What to be careful about", summary: "Keep this in liquid funds or a savings account — not in equities." },
        { title: "What to do next", summary: "Set up a monthly transfer to a liquid/overnight fund or savings account." },
      ],
    });
  }

  // Debt burden
  if (dashboard.health.debtBurden > 35) {
    out.push({
      key: "action-avoid-new-debt",
      kind: "action",
      actionKind: "debt",
      title: "Avoid New Debt",
      reason: `EMIs are at ${dashboard.health.debtBurden.toFixed(0)}% of income — above 35%.`,
      impact: "High",
      confidence: 90,
      category: "Debt repayment",
      ticker: "",
      suggestedMonthlyAmount: 0,
      bucket: "Must Do",
      ctaLabel: "Commit to this",
      explanationCards: [
        { title: "Why this fits you", summary: "Adding more EMIs would crowd out your ability to save and invest for goals." },
        { title: "What to do next", summary: "Pause new loans until debt is below 35% of income." },
      ],
    });
  }

  // Behavior / panic selling
  if (dashboard.behavior.panicSellingRisk === "High") {
    out.push({
      key: "action-stay-the-course",
      kind: "action",
      actionKind: "habit",
      title: "Stick to your SIP routine",
      reason: "Your answers suggest selling investments when markets fall.",
      impact: "Medium",
      confidence: 80,
      category: "review",
      ticker: "",
      suggestedMonthlyAmount: 0,
      bucket: "Consider",
      ctaLabel: "Commit to habit",
      explanationCards: [
        { title: "Why this fits you", summary: "Selling in a downturn locks in losses; staying invested usually recovers." },
        { title: "What to do next", summary: "Use smaller monthly SIPs so a fall feels manageable, and avoid daily checks." },
      ],
    });
  }

  // Savings rate
  if (dashboard.health.savingsRate < 20 && dashboard.summary.investableSurplus > 0) {
    out.push({
      key: "action-increase-savings",
      kind: "action",
      actionKind: "habit",
      title: "Increase savings rate",
      reason: `Saving ${dashboard.health.savingsRate.toFixed(0)}% — under the 25% comfort range.`,
      impact: "Medium",
      confidence: 78,
      category: "savings",
      ticker: "",
      suggestedMonthlyAmount: Math.max(Math.round(dashboard.summary.monthlyIncome * 0.05 / 500) * 500, 1000),
      bucket: "Must Do",
      ctaLabel: "Set a target",
      explanationCards: [
        { title: "Why this fits you", summary: "A higher savings rate makes every other goal easier." },
        { title: "What to do next", summary: "Trim one flexible expense category by ~5% and route it to a goal." },
      ],
    });
  }

  // Goal-driven nudges (off-track top goal)
  const offTrack = dashboard.goals.find((goal) => (goal.feasibilityScore || 100) < 60);
  if (offTrack) {
    out.push({
      key: `action-goal-${offTrack.id}`,
      kind: "action",
      // A monthly top-up SIP toward the goal — NOT a one-time lump sum. (Using
      // "lump_sum" here made the compact card say "/mo" while the dialog said
      // "one-time" for the same number.)
      actionKind: "fund",
      title: `Catch up on ${offTrack.name}`,
      reason: `On track to miss this goal. Needs ${inr(offTrack.requiredMonthlyInvestment)}/month.`,
      impact: "High",
      confidence: 82,
      category: offTrack.name,
      ticker: "",
      suggestedMonthlyAmount: offTrack.requiredMonthlyInvestment || 0,
      bucket: "Must Do",
      goalName: offTrack.name,
      ctaLabel: "Boost contribution",
      explanationCards: [
        { title: "Why this fits you", summary: `${offTrack.name} is one of your saved goals and is currently behind schedule.` },
        { title: "What supports it", summary: "Adding monthly contribution gets the goal back on its target timeline." },
      ],
    });
  }

  return out;
}

function recToItem(rec: AdvancedRecommendation): ActionItem {
  const explanation = explanationCardsFor(rec);
  const title = friendlyTitle(rec);
  return {
    key: keyOf(rec),
    kind: "recommendation",
    actionKind: "fund",
    title,
    instrumentName: rec.instrumentName || rec.recommendationTitle || "",
    reason: shortReason(rec, explanation),
    impact: bucketImpact(rec),
    confidence: rec.confidenceScore || rec.convictionScore || 0,
    category: rec.assetType || rec.assetClass || rec.recommendationType || "Investment",
    ticker: rec.ticker || "",
    suggestedMonthlyAmount: rec.suggestedMonthlyAmount || 0,
    expectedReturn: formatExpectedReturn(rec),
    risk: rec.riskLevel,
    bucket: rec.confidenceScore >= 75 || rec.goalPriority <= 1 ? "Must Do" : rec.confidenceScore >= 55 ? "Consider" : "Explore",
    goalName: rec.linkedGoals?.[0]?.name || rec.goalTag,
    ctaLabel: "Take Action",
    explanationCards: explanation,
    isFundPick: rec.isFundPick,
    factorDrivers: rec.factorDrivers,
    factorInsights: rec.factorInsights,
    goalFunding: rec.goalFunding,
    community: (rec.sentimentSignal as { community?: CommunitySentiment } | undefined)?.community,
  };
}

function shortReason(rec: AdvancedRecommendation, cards: { summary: string }[]) {
  const goal = rec.linkedGoals?.[0]?.name || rec.goalTag;
  if (goal) return `Supports your ${goal} Goal`;
  const first = cards[0]?.summary || rec.conciseReason || rec.whyThisMatters || rec.userSpecificReasoning || "Supports your overall plan.";
  const sentence = first.split(/(?<=[.!?])\s+/)[0].replace(/[.!?]+$/, "");
  return sentence.length > 80 ? `${sentence.slice(0, 78)}…` : sentence;
}

// Cap the active plan at the 3 highest-priority pending actions. Everything
// else cascades into Consider, then Explore. Completed actions are dropped from
// the active plan so finishing one automatically promotes the next item up —
// the plan keeps updating and re-ordering itself as the user makes progress.
export const MUST_DO_LIMIT = 3;
export const CONSIDER_LIMIT = 8;
export const EXPLORE_LIMIT = 15;

function priorityScore(item: ActionItem): number {
  const bucketWeight = item.bucket === "Must Do" ? 2 : item.bucket === "Consider" ? 1 : 0;
  return bucketWeight * 1000 + impactRank(item.impact) * 100 + item.confidence;
}

// Calibrate the plan to this month's budget so no suggested amount ever exceeds
// what the user actually has to invest. The active "Do first" window shares the
// budget by priority (emergency-style items first) with a small ₹500 floor so
// every active money action stays startable; later ideas are shown capped at the
// budget. The ideal/needed figure is preserved on idealMonthlyAmount so the UI
// can honestly surface any gap ("start with ₹500 · goal needs ₹49,000/mo").
const BUDGET_FLOOR = 500;

function calibrateToBudget(ranked: ActionItem[], available: number): ActionItem[] {
  const out = ranked.map((item) => ({ ...item, idealMonthlyAmount: item.suggestedMonthlyAmount }));
  if (!available || available <= 0) return out;

  const activeMoneyIdx = out
    .slice(0, MUST_DO_LIMIT)
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => (item.idealMonthlyAmount || 0) > 0)
    .map(({ idx }) => idx);

  let remaining = available;
  // 1) Reserve a startable floor for each active money item (budget permitting).
  for (const idx of activeMoneyIdx) {
    const give = Math.max(0, Math.min(BUDGET_FLOOR, out[idx].idealMonthlyAmount || 0, remaining));
    out[idx].suggestedMonthlyAmount = give;
    remaining -= give;
  }
  // 2) Top up by priority order (already sorted) up to each item's ideal need.
  for (const idx of activeMoneyIdx) {
    if (remaining <= 0) break;
    const room = (out[idx].idealMonthlyAmount || 0) - out[idx].suggestedMonthlyAmount;
    if (room <= 0) continue;
    const topUp = Math.floor(Math.min(room, remaining) / 500) * 500;
    out[idx].suggestedMonthlyAmount += topUp;
    remaining -= topUp;
  }

  // 3) Later ideas (Consider/Explore): never display more than the monthly budget.
  const cap = Math.floor(available / 500) * 500 || available;
  for (let i = 0; i < out.length; i += 1) {
    if (activeMoneyIdx.includes(i)) continue;
    if ((out[i].idealMonthlyAmount || 0) > available) out[i].suggestedMonthlyAmount = cap;
  }
  return out;
}

export function buildPlan(items: ActionItem[], takenKeys: Set<string>, available = 0, keepTaken = false): Record<TabName, ActionItem[]> {
  if (keepTaken) {
    // Plan page: the active set is the top MUST_DO_LIMIT by priority across ALL
    // items (taken or not), so the plan's membership is stable. Ticking one off
    // moves it to "Completed" WITHOUT promoting a 4th — the active list only
    // changes when priorities or the budget change, not when you make progress.
    const rankedAll = items.slice().sort((a, b) => priorityScore(b) - priorityScore(a));
    const planSet = rankedAll.slice(0, MUST_DO_LIMIT);
    const pending = planSet.filter((item) => !takenKeys.has(item.key));
    // Only the still-pending members share this month's (already committed-
    // reduced) budget; taken members show their committed amount in the UI.
    const sizedPending = calibrateToBudget(pending, available);
    const done = items
      .filter((item) => takenKeys.has(item.key))
      .sort((a, b) => priorityScore(b) - priorityScore(a));
    const overflow = rankedAll.slice(MUST_DO_LIMIT).filter((item) => !takenKeys.has(item.key));
    return {
      "Must Do": [...sizedPending, ...done],
      Consider: overflow.slice(0, CONSIDER_LIMIT),
      Explore: overflow.slice(CONSIDER_LIMIT, CONSIDER_LIMIT + EXPLORE_LIMIT),
    };
  }
  // Dashboard / default: rank pending-only and show the top MUST_DO_LIMIT, so a
  // completed item drops out and the next pending item promotes into the window.
  const ranked = items
    .filter((item) => !takenKeys.has(item.key))
    .sort((a, b) => priorityScore(b) - priorityScore(a));
  const calibrated = calibrateToBudget(ranked, available);
  const mustDo = calibrated.slice(0, MUST_DO_LIMIT);
  const overflow = calibrated.slice(MUST_DO_LIMIT);
  return {
    "Must Do": mustDo,
    Consider: overflow.slice(0, CONSIDER_LIMIT),
    Explore: overflow.slice(CONSIDER_LIMIT, CONSIDER_LIMIT + EXPLORE_LIMIT),
  };
}

export function layerItems(items: ActionItem[], takenKeys: Set<string>): Record<TabName, ActionItem[]> {
  return buildPlan(items, takenKeys, 0);
}

function impactRank(impact: ActionItem["impact"]): number {
  return impact === "High" ? 3 : impact === "Medium" ? 2 : 1;
}

export function planConfidence(items: ActionItem[]): number {
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, item) => sum + item.confidence, 0) / items.length);
}

function bucketImpact(rec: AdvancedRecommendation): ActionItem["impact"] {
  if (rec.goalImpacts?.[0]?.label) {
    const label = rec.goalImpacts[0].label.toLowerCase();
    if (label.includes("high")) return "High";
    if (label.includes("medium")) return "Medium";
    if (label.includes("low")) return "Low";
  }
  const score = rec.importanceScore || rec.confidenceScore || 0;
  if (score >= 75) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}

function dedupKey(item: ActionItem): string {
  const norm = item.title.toLowerCase().replace(/[^a-z]+/g, "");
  if (norm.includes("emergency")) return "emergency-fund";
  if (norm.includes("avoidnewdebt")) return "debt-action";
  return item.key;
}

function explanationCardsFor(rec: AdvancedRecommendation) {
  if (rec.explanation_cards?.length) return rec.explanation_cards.map((item) => ({ title: item.question, summary: item.answer }));
  if (rec.explanationCards?.length) return rec.explanationCards;
  return [
    { title: "Why this fits you", summary: rec.userSpecificReasoning || "Matches your saved profile and goals." },
    { title: "Why now", summary: rec.currentMarketReasoning || rec.whyNow || "A gradual approach suits current market." },
    { title: "What supports it", summary: rec.supportingSignals?.[0]?.summary || "Supporting signals are being refreshed." },
    { title: "What to be careful about", summary: rec.whatCanGoWrong || rec.riskExplanation || "Market values can move up and down." },
  ];
}

function friendlyTitle(rec: AdvancedRecommendation): string {
  const name = rec.instrumentName || "";
  const action = (rec.action || "").toLowerCase();
  if (action.includes("watch")) return `Review ${name}`;
  if (action.includes("avoid")) return `Avoid ${name}`;
  if (/emergency/i.test(name)) return "Build Emergency Fund";
  if (/sip|equity|nifty|index/i.test(name)) return `Increase ${trim(name)} SIP`;
  if (/debt|liquid/i.test(name)) return `Add ${trim(name)}`;
  if (/gold|sgb/i.test(name)) return `Add ${trim(name)}`;
  return trim(name);
}

function trim(value: string) {
  return value.length > 60 ? `${value.slice(0, 58)}…` : value;
}

function keyOf(rec: AdvancedRecommendation): string {
  return String(rec.recommendationKey || rec.id || rec.instrumentName || "");
}

function formatExpectedReturn(rec: AdvancedRecommendation) {
  const expected = rec.expectedReturn;
  if (expected?.label) return expected.label.replace(/CAGR/gi, "p.a.");
  if (expected?.cagrRange) return `${expected.cagrRange} p.a.`;
  if (typeof expected?.expectedCagr === "number") return `${expected.expectedCagr}% p.a.`;
  if (rec.expectedReturnRange) return rec.expectedReturnRange;
  return "";
}

// ---------- Display helpers (shared so dashboard + plan read the same way) ----------

/** Beginner-friendly "how much" for a card. Money actions show ₹/mo; behaviour
 *  actions (debt, habits, reviews) get a plain-language label instead of ₹0. */
export function amountLabel(item: ActionItem): string {
  if (item.suggestedMonthlyAmount > 0) return `${inr(item.suggestedMonthlyAmount)}/mo`;
  if (item.actionKind === "debt") return "No new loans";
  if (item.actionKind === "habit") return "Build the habit";
  if (item.actionKind === "review") return "Quick review";
  return "When you're ready";
}

/** True when the amountLabel is a real rupee figure (drives styling/emphasis). */
export function hasMoneyAmount(item: ActionItem): boolean {
  return item.suggestedMonthlyAmount > 0;
}

/** Honest gap line when this month's budget can't fully fund the ideal need. */
export function idealNote(item: ActionItem): string {
  const ideal = item.idealMonthlyAmount || 0;
  if (item.suggestedMonthlyAmount > 0 && ideal > item.suggestedMonthlyAmount) {
    return `goal needs ${inr(ideal)}/mo`;
  }
  return "";
}

/** Short "what this is for" tag — the goal it funds, or a friendly purpose. */
export function purposeTag(item: ActionItem): string {
  if (item.goalName) return item.goalName;
  const cat = (item.category || "").toLowerCase();
  if (cat.includes("emergency")) return "Safety net";
  if (cat.includes("debt")) return "Debt control";
  if (cat.includes("saving")) return "Save more";
  if (cat.includes("review")) return "Good habit";
  if (cat.includes("crypto")) return "Growth bet";
  if (cat.includes("gold")) return "Stability";
  if (cat.includes("equity") || cat.includes("fund") || cat.includes("index")) return "Long-term growth";
  return item.category || "Your plan";
}
