import type { AssetIcon } from "./types";

/**
 * Behavioural / action icons.
 * Used for non-investment Action Plan items: "Catch up on Marriage",
 * "Avoid New Debt", "Build Emergency Fund", "Stick to your SIP routine", etc.
 *
 * These outrank brand and asset detection so a goal-catchup never shows
 * a fund-house badge accidentally.
 */

export const ACTION_ICONS = {
  catchupMarriage: {
    bg: "bg-rose-500",
    label: "Catch up on marriage goal",
    svg: (
      <path
        d="M32 52 Q14 38 14 26 Q14 18 22 16 Q28 16 32 22 Q36 16 42 16 Q50 18 50 26 Q50 38 32 52 Z"
        fill="#FFFFFF"
      />
    ),
  } as AssetIcon,

  catchupEducation: {
    bg: "bg-amber-600",
    label: "Catch up on education goal",
    svg: (
      <>
        {/* mortarboard top */}
        <path d="M8 24 L32 14 L56 24 L32 34 Z" fill="#FFFFFF" />
        {/* cap base */}
        <path d="M18 28 L18 38 Q18 44 32 44 Q46 44 46 38 L46 28" fill="#FFFFFF" />
        {/* tassel */}
        <line x1="50" y1="22" x2="50" y2="34" stroke="#FFFFFF" strokeWidth="2" />
        <circle cx="50" cy="36" r="3" fill="#FFFFFF" />
      </>
    ),
  } as AssetIcon,

  catchupHouse: {
    bg: "bg-blue-700",
    label: "Catch up on house goal",
    svg: (
      <>
        {/* roof */}
        <path d="M10 32 L32 14 L54 32 L48 32 L48 50 L16 50 L16 32 Z" fill="#FFFFFF" />
        {/* door */}
        <rect x="28" y="36" width="8" height="14" fill="#1D4ED8" />
        {/* window */}
        <rect x="20" y="34" width="6" height="6" fill="#1D4ED8" />
        <rect x="38" y="34" width="6" height="6" fill="#1D4ED8" />
      </>
    ),
  } as AssetIcon,

  catchupCar: {
    bg: "bg-slate-700",
    label: "Catch up on car goal",
    svg: (
      <>
        <path d="M18 32 L24 22 L40 22 L46 32 Z" fill="#FFFFFF" />
        <rect x="10" y="32" width="44" height="14" rx="2" fill="#FFFFFF" />
        <circle cx="20" cy="48" r="5" fill="#0F172A" />
        <circle cx="44" cy="48" r="5" fill="#0F172A" />
      </>
    ),
  } as AssetIcon,

  catchupRetirement: {
    bg: "bg-indigo-700",
    label: "Catch up on retirement goal",
    svg: (
      <>
        {/* calendar body */}
        <rect x="12" y="16" width="40" height="36" rx="3" fill="#FFFFFF" />
        {/* header */}
        <rect x="12" y="16" width="40" height="8" rx="3" fill="#4338CA" />
        {/* rings */}
        <rect x="20" y="12" width="3" height="8" fill="#FFFFFF" rx="1" />
        <rect x="41" y="12" width="3" height="8" fill="#FFFFFF" rx="1" />
        {/* date highlight */}
        <circle cx="32" cy="38" r="8" fill="#4338CA" />
      </>
    ),
  } as AssetIcon,

  catchupTravel: {
    bg: "bg-sky-600",
    label: "Catch up on travel goal",
    svg: (
      <path
        d="M14 36 L14 32 L30 30 L40 14 L46 14 L40 32 L52 30 L56 30 L56 34 L40 38 L34 50 L28 50 L32 38 L20 40 Z"
        fill="#FFFFFF"
      />
    ),
  } as AssetIcon,

  catchupGeneric: {
    bg: "bg-violet-600",
    label: "Catch up on goal",
    svg: (
      <>
        <circle cx="32" cy="32" r="18" fill="none" stroke="#FFFFFF" strokeWidth="3" />
        <circle cx="32" cy="32" r="10" fill="none" stroke="#FFFFFF" strokeWidth="3" />
        <circle cx="32" cy="32" r="3" fill="#FFFFFF" />
      </>
    ),
  } as AssetIcon,

  avoidDebt: {
    bg: "bg-rose-600",
    label: "Avoid new debt",
    svg: (
      <>
        {/* credit card */}
        <rect x="10" y="20" width="44" height="26" rx="3" fill="#FFFFFF" />
        <rect x="10" y="26" width="44" height="5" fill="#9F1239" />
        {/* slash */}
        <line x1="14" y1="50" x2="50" y2="14" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
        <line x1="14" y1="50" x2="50" y2="14" stroke="#9F1239" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  } as AssetIcon,

  reduceDebt: {
    bg: "bg-rose-600",
    label: "Reduce debt",
    svg: (
      <>
        <rect x="10" y="20" width="44" height="26" rx="3" fill="#FFFFFF" />
        <rect x="10" y="26" width="44" height="5" fill="#9F1239" />
        {/* down arrow */}
        <path d="M44 36 L44 44 L40 44 L48 52 L56 44 L52 44 L52 36 Z" fill="#9F1239" />
      </>
    ),
  } as AssetIcon,

  increaseSavings: {
    bg: "bg-emerald-600",
    label: "Increase savings",
    svg: (
      <>
        {/* sprout */}
        <path d="M14 50 Q32 46 50 50 L50 54 L14 54 Z" fill="#FFFFFF" />
        <line x1="32" y1="50" x2="32" y2="30" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 34 Q22 32 20 24 Q28 22 32 30 Z" fill="#FFFFFF" />
        <path d="M32 30 Q42 28 44 20 Q36 18 32 26 Z" fill="#FFFFFF" />
        {/* upward arrow accent */}
        <path d="M44 16 L44 8 L40 8 L46 2 L52 8 L48 8 L48 16 Z" fill="#FBBF24" transform="translate(0 10)" />
      </>
    ),
  } as AssetIcon,

  stickToSip: {
    bg: "bg-blue-600",
    label: "Stick to your SIP",
    svg: (
      <>
        {/* circular arrows */}
        <path
          d="M32 14 A18 18 0 0 1 50 32 L46 32 L52 40 L58 32 L54 32 A22 22 0 0 0 32 10 Z"
          fill="#FFFFFF"
        />
        <path
          d="M32 50 A18 18 0 0 1 14 32 L18 32 L12 24 L6 32 L10 32 A22 22 0 0 0 32 54 Z"
          fill="#FFFFFF"
        />
      </>
    ),
  } as AssetIcon,

  startSip: {
    bg: "bg-emerald-600",
    label: "Start SIP",
    svg: (
      <>
        {/* wallet body */}
        <rect x="10" y="20" width="44" height="28" rx="4" fill="#FFFFFF" />
        {/* fold */}
        <path d="M10 24 Q10 18 16 18 L40 18 L40 24 Z" fill="#FFFFFF" />
        {/* coin slot */}
        <circle cx="42" cy="34" r="4" fill="#059669" />
        <text
          x="42"
          y="38"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight="700"
          fontSize="6"
          fill="#FFFFFF"
        >
          ₹
        </text>
      </>
    ),
  } as AssetIcon,

  review: {
    bg: "bg-amber-500",
    text: "text-slate-950",
    label: "Review plan",
    svg: (
      <>
        {/* clock face */}
        <circle cx="32" cy="32" r="18" fill="none" stroke="#0F172A" strokeWidth="3" />
        {/* clock hands */}
        <line x1="32" y1="32" x2="32" y2="20" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
        <line x1="32" y1="32" x2="42" y2="36" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
        {/* refresh ticks */}
        <path d="M50 14 L54 14 L54 18" stroke="#0F172A" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    ),
  } as AssetIcon,
} as const;

export function actionIconFor(text: string): AssetIcon | null {
  const v = text.toLowerCase();

  if (/\bcatch[\s-]?up\b|\bcatchup\b/.test(v)) {
    if (/marriage|wedding/.test(v)) return ACTION_ICONS.catchupMarriage;
    if (/child|baby|education|school|college/.test(v)) return ACTION_ICONS.catchupEducation;
    if (/house|home|property|down payment/.test(v)) return ACTION_ICONS.catchupHouse;
    if (/car|vehicle/.test(v)) return ACTION_ICONS.catchupCar;
    if (/retire/.test(v)) return ACTION_ICONS.catchupRetirement;
    if (/travel|trip|vacation/.test(v)) return ACTION_ICONS.catchupTravel;
    return ACTION_ICONS.catchupGeneric;
  }

  if (/avoid.*debt|avoid.*loan/.test(v)) return ACTION_ICONS.avoidDebt;
  if (/reduce.*debt|repay|pay.*off.*loan|pay.*down.*debt/.test(v)) return ACTION_ICONS.reduceDebt;
  if (/increase.*savings|save.*more|savings.*rate/.test(v)) return ACTION_ICONS.increaseSavings;
  if (/stick.*sip|stay.*course|don'?t.*panic|hold.*through|sip.*routine/.test(v)) return ACTION_ICONS.stickToSip;
  if (/increase.*sip|boost.*sip|raise.*sip|step.*up.*sip|top.*up.*sip|start.*sip/.test(v)) return ACTION_ICONS.startSip;
  if (/rebalance|review.*plan|review.*portfolio/.test(v)) return ACTION_ICONS.review;

  return null;
}
