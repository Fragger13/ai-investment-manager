import type { PapaMood } from "@/app/onboarding/_components/papa-bubble";

// A per-page "Guide me" walkthrough. Unlike the one-time onboarding PapaTour
// (which hops across tabs), each of these stays on a single page and explains
// what each part is and how to read it. Steps with a `target` spotlight a
// `[data-tour="..."]` element; steps without one show a centered card.
export type PageTourStep = {
  target?: string;
  title: string;
  body: string;
  mood?: PapaMood;
  // Interactive "video" steps. When the step becomes active, click `openClick`
  // (e.g. open a dialog) so the spotlight can land on live content; when the
  // step ends, click `closeClick` (e.g. the dialog's close button) to tidy up.
  openClick?: string;
  closeClick?: string;
  // On the final step of a tour, `endClick` follows a link/button (e.g. opens a
  // detail page); `flagOnEnd` drops a sessionStorage flag so the next page can
  // auto-start its own tour, making the walkthrough flow across the route change.
  endClick?: string;
  flagOnEnd?: string;
};

// sessionStorage key: set when the Discover tour hands off to a detail page, so
// the detail page auto-plays its own walkthrough on arrival.
export const ASSET_DETAIL_TOUR_FLAG = "askpapa:asset-detail-tour";

// Keyed by exact pathname. The floating launcher only appears on these routes.
export const PAGE_TOURS: Record<string, PageTourStep[]> = {
  "/dashboard": [
    { title: "This is your Home 🏠", body: "Your whole money picture at a glance, beta. Let me walk you through what each part means and how to read it.", mood: "warm" },
    { target: "[data-tour='available']", title: "What you can invest", body: "What's free to invest this month after rent, EMIs and expenses. Every plan I build is sized to exactly this number.", mood: "warm" },
    { target: "[data-tour='health']", title: "Your money health", body: "One score out of 100 for how you're doing across savings, safety net and debt. Green ticks are good; the rest are things we'll fix together.", mood: "thoughtful" },
    { target: "[data-tour='dash-snapshot']", title: "Your money snapshot", body: "Income coming in, fixed commitments going out, and your total net worth, all in one row.", mood: "blessed" },
    { target: "[data-tour='dash-commitments']", title: "Peek inside your commitments", body: "See that little arrow on the Monthly commitments tile? Tap it and the full breakdown opens. Watch, I'll open it for you.", mood: "thoughtful" },
    { target: "[data-tour='commitments-detail']", title: "Every rupee, accounted for", body: "Here it is: rent, each EMI and your monthly expenses, all laid out. Now you know exactly where the money goes before we invest a single rupee.", mood: "caring", openClick: "[data-tour='dash-commitments-open']", closeClick: "[data-tour-close]" },
    { target: "[data-tour='dash-actions']", title: "Do this first", body: "A preview of your top moves for the month. The full set lives on the Plan tab, and it stays in sync with this.", mood: "proud" },
    { target: "[data-tour='theme-toggle']", title: "Light or dark, your call", body: "Tap this any time to switch between light and dark mode. Easy on the eyes at night, beta.", mood: "curious" },
  ],
  "/recommendations": [
    { target: "[data-tour='plan-intro']", title: "Your plan for the month", body: "Here's the heart of it, beta: each month I hand you a fresh, short plan. Work through it and you're done for the month. Simple as that.", mood: "proud" },
    { target: "[data-tour='plan-confidence']", title: "Plan confidence", body: "How well this month's plan fits your money and goals right now. Higher is steadier; lower just means give it a slower, careful read.", mood: "thoughtful" },
    { target: "[data-tour='plan-progress']", title: "This month's progress", body: "Your top moves and how many you've ticked off. When this bar hits 100%, you're done for the month. Go live your life.", mood: "warm" },
    { target: "[data-tour='plan-item']", title: "What a move looks like", body: "Each card is one pick: what it is, why it fits you, and roughly what it could return. No jargon, I promise.", mood: "caring" },
    { target: "[data-tour='plan-action']", title: "Do it, or top it up", body: "Hit Take Action to log a pick. Let me open it so you can see what's inside.", mood: "caring" },
    { target: "[data-tour='takeaction-detail']", title: "Set it up your way", body: "Pick a monthly SIP or a one-time lump sum, set the amount and date, and I'll even link it to the goal it's funding. Log it here and it counts toward this month's plan. Got spare cash later? Come back and top up.", mood: "caring", openClick: "[data-tour='plan-action']", closeClick: "[data-tour-close]" },
    { target: "[data-tour='plan-refresh']", title: "Refresh when things change", body: "Changed your income, or just want fresh ideas? Refresh and I'll rebuild the plan around your latest numbers.", mood: "curious" },
    { title: "That's the rhythm 💚", body: "Each month: finish your plan and you're done. Spare cash left over? Top up a pick above. Curious to learn or explore more? Wander into Discover whenever you like.", mood: "celebrate" },
  ],
  "/goals": [
    { title: "Your goals 🎯", body: "Everything you're saving for, in one place. Let me show you how to read a goal and keep it on track.", mood: "loving" },
    { target: "[data-tour='goal-card']", title: "Where each goal stands", body: "Target, what you've saved, what's left, and the time you have. The bar and the On track / Off track badge tell you at a glance whether you'll get there.", mood: "thoughtful" },
    { target: "[data-tour='goal-link']", title: "The clever bit", body: "Link an investment you already own to a goal, and it fills up on its own as that money grows. Tap Link holdings to connect one.", mood: "loving" },
    { target: "[data-tour='goal-add']", title: "Add as many as you like", body: "New dream? Add a goal and I'll fold it into your monthly plan. Not sure of the target amount? I can estimate it for you.", mood: "proud" },
  ],
  "/portfolio": [
    { title: "Your portfolio 💰", body: "Everything you own, in one number, plus where it's all heading. Here's how to read it.", mood: "blessed" },
    { target: "[data-tour='networth']", title: "Your net worth", body: "Everything you own today, with the profit or loss on your holdings and what your plan is quietly building over time.", mood: "blessed" },
    { target: "[data-tour='portfolio-holdings']", title: "Your holdings mix", body: "Where every rupee actually sits today. Hover a slice to break it down, and tap View all holdings for the full itemised list, fund by fund, stock by stock.", mood: "thoughtful" },
    { target: "[data-tour='portfolio-prices']", title: "Live prices", body: "Tap here to pull fresh prices for your stocks, funds, crypto and gold, so your net worth is bang up to date.", mood: "curious" },
    { target: "[data-tour='portfolio-projection']", title: "Where it's heading", body: "Your current holdings plus the monthly commitments from your plan, projected forward. Small steps, compounding quietly.", mood: "thoughtful" },
  ],
  "/asset-intelligence": [
    { title: "Discover 🔍", body: "This is your optional playground, beta. Finished your plan and want to explore or learn a little finance? This is the place.", mood: "curious" },
    { target: "[data-tour='discover-tabs']", title: "Browse by type", body: "Filter ideas by what they are, funds, stocks and more, or search up top for something specific.", mood: "warm" },
    { target: "[data-tour='discover-pick']", title: "Hand-picked ideas", body: "Each card fits your goals and risk level. Hit the bookmark to save it, and saved ideas land in your Plan under Saved by you. Stuck? The Ask AI Coach card below can point you to what fits.", mood: "proud" },
    { target: "[data-tour='discover-details']", title: "Open the full story", body: "Every idea has a View Details button for the deep dive. Watch, I'll open my pick and walk you right through it.", mood: "curious", endClick: "[data-tour='discover-details']", flagOnEnd: ASSET_DETAIL_TOUR_FLAG },
  ],
  // Plays on an idea's detail page. Auto-started as a continuation when the
  // Discover tour hands off (via ASSET_DETAIL_TOUR_FLAG), and also available on
  // its own from the detail page's "Guide me". No intro step: when continued it
  // lands straight on the detail card so the View Details step flows into it.
  "asset-detail": [
    { target: "[data-tour='detail-why']", title: "Why this fits you", body: "Here's the detail card. Right up top: exactly why this one matches your goals and your risk level. If this part doesn't feel like you, it isn't for you.", mood: "loving" },
    { target: "[data-tour='detail-numbers']", title: "The numbers that matter", body: "What people are saying, the expected return, and a suggested SIP to start. A quick, honest read before you go deeper.", mood: "thoughtful" },
    { target: "[data-tour='detail-risk']", title: "Know the risks", body: "I never hide the downside. Here's the risk level and exactly what could go wrong, so you invest with eyes open.", mood: "caring" },
    { target: "[data-tour='detail-invest']", title: "Ready when you are", body: "Like it? Add it to your plan, or take action now to set a monthly SIP or a one-time amount. No rush, beta.", mood: "proud" },
  ],
};
