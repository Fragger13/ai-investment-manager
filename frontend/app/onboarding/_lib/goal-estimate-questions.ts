// Quick-reply questions that feed the goal-amount estimator. The chip `value`
// codes must match the backend cost tables in
// `app/services/goals/goal_estimator.py`.

export type EstimateChip = { value: string; label: string };
export type EstimateQuestion = {
  key: string;
  prompt: string;
  chips: EstimateChip[];
  kind?: "chips" | "text";
  placeholder?: string;
};

// Every named goal type can ask Papa for a target estimate.
export function canEstimate(goalType: string): boolean {
  return Boolean(goalType);
}

// Profile-derived goals are computed from the user's own numbers, so they don't
// need a "when do you need it" inflation question.
const NO_WHEN_GOALS = new Set<string>(["Retirement", "Financial freedom", "Debt repayment"]);

export function usesWhenYears(goalType: string): boolean {
  return !NO_WHEN_GOALS.has(goalType);
}

const LIFESTYLE_CHIPS: EstimateChip[] = [
  { value: "lean", label: "The same as now" },
  { value: "comfortable", label: "A bit more comfortable" },
  { value: "lavish", label: "Live it up" },
];

const CITY_TIER: EstimateChip[] = [
  { value: "metro", label: "Metro (Mumbai, Delhi, Bengaluru…)" },
  { value: "tier1", label: "Big city" },
  { value: "tier2", label: "Smaller city" },
  { value: "tier3", label: "Town" },
];

// Shared "when do you need it" question — drives the inflation adjustment. The
// helper skips this when the goal already has a target date.
export const WHEN_QUESTION: EstimateQuestion = {
  key: "whenYears",
  prompt: "When will you need this money?",
  chips: [
    { value: "lt2", label: "Under 2 years" },
    { value: "2-5", label: "2 to 5 years" },
    { value: "6-10", label: "6 to 10 years" },
    { value: "gt10", label: "More than 10 years" },
  ],
};

const QUESTIONS: Record<string, EstimateQuestion[]> = {
  "House purchase": [
    { key: "cityTier", prompt: "Where are you looking to buy?", chips: CITY_TIER },
    {
      key: "bhk",
      prompt: "What size are you thinking?",
      chips: [
        { value: "1bhk", label: "1 BHK" },
        { value: "2bhk", label: "2 BHK" },
        { value: "3bhk", label: "3 BHK" },
        { value: "villa", label: "Villa / large home" },
      ],
    },
    {
      key: "stage",
      prompt: "Ready to move in, or under construction?",
      chips: [
        { value: "ready", label: "Ready to move in" },
        { value: "under_construction", label: "Under construction" },
      ],
    },
  ],
  "Car purchase": [
    {
      key: "segment",
      prompt: "What kind of car?",
      chips: [
        { value: "hatchback", label: "Hatchback" },
        { value: "sedan", label: "Sedan" },
        { value: "suv", label: "SUV" },
        { value: "luxury", label: "Luxury" },
      ],
    },
    {
      key: "condition",
      prompt: "New or pre-owned?",
      chips: [
        { value: "new", label: "Brand new" },
        { value: "used", label: "Pre-owned" },
      ],
    },
  ],
  "Child education": [
    {
      key: "level",
      prompt: "Which stage of education?",
      chips: [
        { value: "school", label: "School" },
        { value: "undergrad", label: "College / undergrad" },
        { value: "postgrad", label: "Postgrad" },
      ],
    },
    {
      key: "locale",
      prompt: "In India or abroad?",
      chips: [
        { value: "india", label: "In India" },
        { value: "abroad", label: "Abroad" },
      ],
    },
  ],
  "Higher education": [
    {
      key: "level",
      prompt: "Which stage of education?",
      chips: [
        { value: "undergrad", label: "Undergrad" },
        { value: "postgrad", label: "Postgrad" },
      ],
    },
    {
      key: "locale",
      prompt: "In India or abroad?",
      chips: [
        { value: "india", label: "In India" },
        { value: "abroad", label: "Abroad" },
      ],
    },
  ],
  Marriage: [
    {
      key: "scale",
      prompt: "What scale are you picturing?",
      chips: [
        { value: "simple", label: "Simple & intimate" },
        { value: "moderate", label: "Mid-scale" },
        { value: "grand", label: "Grand" },
      ],
    },
    { key: "cityTier", prompt: "Which city?", chips: CITY_TIER.slice(0, 3) },
  ],
  Travel: [
    {
      key: "locale",
      prompt: "Where to?",
      chips: [
        { value: "domestic", label: "Within India" },
        { value: "international", label: "Abroad" },
      ],
    },
    {
      key: "travelers",
      prompt: "How many travellers?",
      chips: [
        { value: "solo", label: "Just me" },
        { value: "couple", label: "Two of us" },
        { value: "family", label: "Family" },
      ],
    },
  ],
  "Business/startup": [
    {
      key: "scale",
      prompt: "How big a start?",
      chips: [
        { value: "side", label: "A side hustle" },
        { value: "small", label: "A small business" },
        { value: "ambitious", label: "Something ambitious" },
      ],
    },
  ],
  Retirement: [
    { key: "lifestyle", prompt: "What lifestyle would you like after you retire?", chips: LIFESTYLE_CHIPS },
  ],
  "Financial freedom": [
    { key: "lifestyle", prompt: "What lifestyle do you want once you're financially free?", chips: LIFESTYLE_CHIPS },
  ],
  "Debt repayment": [
    {
      key: "owe",
      prompt: "Roughly how much do you owe in total?",
      chips: [
        { value: "under1l", label: "Under ₹1 lakh" },
        { value: "1-5l", label: "₹1 to 5 lakh" },
        { value: "5-15l", label: "₹5 to 15 lakh" },
        { value: "15l+", label: "₹15 lakh or more" },
      ],
    },
  ],
  Other: [
    {
      key: "ballpark",
      prompt: "Roughly how big is this goal?",
      chips: [
        { value: "small", label: "Small (around ₹1 lakh)" },
        { value: "medium", label: "Medium (a few lakhs)" },
        { value: "large", label: "Large (tens of lakhs)" },
        { value: "xlarge", label: "Very large (₹50 lakh+)" },
      ],
    },
  ],
};

export function questionsFor(goalType: string): EstimateQuestion[] {
  return QUESTIONS[goalType] || QUESTIONS.Other;
}

// ---- "Not sure?" on the Target date -----------------------------------------
// A rough timeline the user can tap instead of picking an exact calendar date.
// Purely deterministic (today + N years), so it fills instantly with no LLM wait.

export type DateChip = { label: string; date: string };

function isoAfterYears(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + Math.round(years));
  return d.toISOString().slice(0, 10);
}

function yearsLabel(years: number): string {
  return years === 1 ? "In 1 year" : `In ${years} years`;
}

// Suggested target-date shortcuts, tuned per goal type. Retirement / financial
// freedom lean on the user's age and desired retirement age when we have them.
export function goalDateSuggestions(
  goalType: string,
  profile?: { age?: number; retirementAge?: number },
): DateChip[] {
  if (goalType === "Retirement" || goalType === "Financial freedom") {
    const age = Number(profile?.age) || 0;
    const retire = Number(profile?.retirementAge) || 60;
    const chips: DateChip[] = [];
    if (age > 0 && retire > age) {
      const yrs = retire - age;
      chips.push({ label: `At ${retire} (in ${yrs} yr${yrs === 1 ? "" : "s"})`, date: isoAfterYears(yrs) });
      for (const y of [10, 20, 30]) {
        if (Math.abs(y - yrs) >= 2) chips.push({ label: yearsLabel(y), date: isoAfterYears(y) });
      }
      return chips.slice(0, 5);
    }
    return [10, 15, 20, 25, 30].map((y) => ({ label: yearsLabel(y), date: isoAfterYears(y) }));
  }
  if (goalType === "Debt repayment") {
    return [1, 2, 3, 5].map((y) => ({ label: yearsLabel(y), date: isoAfterYears(y) }));
  }
  return [1, 2, 3, 5, 10].map((y) => ({ label: yearsLabel(y), date: isoAfterYears(y) }));
}

// Map a target date to the inflation bucket so we can skip the "when" question
// when the user has already set one.
export function whenYearsFromDate(targetDate?: string): string | null {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return null;
  const years = (target.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000);
  if (years < 2) return "lt2";
  if (years <= 5) return "2-5";
  if (years <= 10) return "6-10";
  return "gt10";
}
