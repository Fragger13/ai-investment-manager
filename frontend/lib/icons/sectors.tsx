import type { AssetIcon } from "./types";

/**
 * Sector icons.
 * In-house SVG glyphs — saturated coloured tile with a white pictogram.
 */

export const SECTOR_ICONS = {
  banking: {
    bg: "bg-emerald-700",
    label: "Banking & Financial Services",
    svg: (
      <>
        {/* pediment */}
        <path d="M16 22 L48 22 L32 12 Z" fill="#FFFFFF" />
        {/* entablature */}
        <rect x="14" y="22" width="36" height="3" fill="#FFFFFF" />
        {/* columns */}
        <rect x="18" y="26" width="4" height="20" fill="#FFFFFF" />
        <rect x="30" y="26" width="4" height="20" fill="#FFFFFF" />
        <rect x="42" y="26" width="4" height="20" fill="#FFFFFF" />
        {/* stylobate */}
        <rect x="12" y="48" width="40" height="4" fill="#FFFFFF" />
      </>
    ),
  } as AssetIcon,

  defence: {
    bg: "bg-indigo-700",
    label: "Defence",
    svg: (
      <>
        <path
          d="M32 10 L50 16 L50 32 Q50 46 32 54 Q14 46 14 32 L14 16 Z"
          fill="#FFFFFF"
        />
        <path
          d="M32 22 L34 28 L40 28 L35 32 L37 38 L32 34 L27 38 L29 32 L24 28 L30 28 Z"
          fill="#4338CA"
        />
      </>
    ),
  } as AssetIcon,

  pharma: {
    bg: "bg-rose-500",
    label: "Pharmaceuticals & Healthcare",
    svg: (
      <>
        {/* capsule pill */}
        <rect x="14" y="22" width="36" height="20" rx="10" fill="#FFFFFF" />
        <rect x="14" y="22" width="18" height="20" rx="10" fill="#FECACA" />
        <line x1="32" y1="22" x2="32" y2="42" stroke="#EF4444" strokeWidth="1.5" />
        {/* + symbol */}
        <rect x="40" y="28" width="3" height="8" fill="#EF4444" rx="1" />
        <rect x="38" y="30.5" width="7" height="3" fill="#EF4444" rx="1" />
      </>
    ),
  } as AssetIcon,

  infrastructure: {
    bg: "bg-orange-600",
    label: "Infrastructure",
    svg: (
      <>
        {/* crane mast */}
        <rect x="20" y="14" width="4" height="38" fill="#FFFFFF" />
        {/* horizontal arm */}
        <rect x="20" y="14" width="32" height="4" fill="#FFFFFF" />
        {/* diagonal brace */}
        <line x1="22" y1="22" x2="36" y2="14" stroke="#FFFFFF" strokeWidth="2" />
        {/* hook line */}
        <line x1="42" y1="18" x2="42" y2="32" stroke="#FFFFFF" strokeWidth="2" />
        {/* hook */}
        <path d="M39 32 L45 32 L42 36 Z" fill="#FFFFFF" />
        {/* ground */}
        <rect x="10" y="52" width="44" height="3" fill="#FFFFFF" />
      </>
    ),
  } as AssetIcon,

  technology: {
    bg: "bg-cyan-600",
    label: "Technology / IT",
    svg: (
      <>
        {/* chip body */}
        <rect x="18" y="18" width="28" height="28" rx="3" fill="#FFFFFF" />
        {/* core */}
        <rect x="24" y="24" width="16" height="16" rx="1" fill="#0891B2" />
        {/* pins top */}
        <rect x="22" y="14" width="3" height="4" fill="#FFFFFF" />
        <rect x="30" y="14" width="3" height="4" fill="#FFFFFF" />
        <rect x="38" y="14" width="3" height="4" fill="#FFFFFF" />
        {/* pins bottom */}
        <rect x="22" y="46" width="3" height="4" fill="#FFFFFF" />
        <rect x="30" y="46" width="3" height="4" fill="#FFFFFF" />
        <rect x="38" y="46" width="3" height="4" fill="#FFFFFF" />
        {/* pins left */}
        <rect x="14" y="22" width="4" height="3" fill="#FFFFFF" />
        <rect x="14" y="30" width="4" height="3" fill="#FFFFFF" />
        <rect x="14" y="38" width="4" height="3" fill="#FFFFFF" />
        {/* pins right */}
        <rect x="46" y="22" width="4" height="3" fill="#FFFFFF" />
        <rect x="46" y="30" width="4" height="3" fill="#FFFFFF" />
        <rect x="46" y="38" width="4" height="3" fill="#FFFFFF" />
      </>
    ),
  } as AssetIcon,

  energy: {
    bg: "bg-yellow-500",
    text: "text-slate-950",
    label: "Energy & Power",
    svg: (
      <path
        d="M34 10 L18 36 L28 36 L24 54 L46 28 L36 28 L40 10 Z"
        fill="#0F172A"
      />
    ),
  } as AssetIcon,

  fmcg: {
    bg: "bg-pink-500",
    label: "FMCG / Consumer",
    svg: (
      <>
        {/* basket body */}
        <path d="M14 26 L50 26 L46 50 L18 50 Z" fill="#FFFFFF" />
        {/* handle */}
        <path
          d="M22 26 L26 14 L38 14 L42 26"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3"
        />
        {/* weave */}
        <line x1="22" y1="34" x2="42" y2="34" stroke="#EC4899" strokeWidth="1.5" />
        <line x1="20" y1="42" x2="44" y2="42" stroke="#EC4899" strokeWidth="1.5" />
      </>
    ),
  } as AssetIcon,

  auto: {
    bg: "bg-slate-700",
    label: "Automobiles",
    svg: (
      <>
        {/* cabin */}
        <path d="M18 32 L24 22 L40 22 L46 32 Z" fill="#FFFFFF" />
        {/* body */}
        <rect x="10" y="32" width="44" height="14" rx="2" fill="#FFFFFF" />
        {/* wheels */}
        <circle cx="20" cy="48" r="5" fill="#0F172A" />
        <circle cx="44" cy="48" r="5" fill="#0F172A" />
        <circle cx="20" cy="48" r="2" fill="#FFFFFF" />
        <circle cx="44" cy="48" r="2" fill="#FFFFFF" />
        {/* windshield */}
        <path d="M23 24 L40 24 L43 30 L21 30 Z" fill="#0F172A" />
      </>
    ),
  } as AssetIcon,

  oilGas: {
    bg: "bg-slate-800",
    label: "Oil & Gas",
    svg: (
      <>
        {/* fuel pump body */}
        <rect x="18" y="20" width="22" height="30" rx="2" fill="#FFFFFF" />
        {/* screen */}
        <rect x="22" y="24" width="14" height="8" fill="#0F172A" />
        {/* trigger */}
        <path
          d="M40 28 L48 28 L48 38 Q48 42 44 42"
          stroke="#FFFFFF"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        {/* base */}
        <rect x="14" y="50" width="30" height="3" fill="#FFFFFF" />
      </>
    ),
  } as AssetIcon,
} as const;
