import type { AssetIcon } from "./types";

/**
 * Mutual-fund / ETF category icons.
 * In-house SVG glyphs designed to be quickly recognisable at small sizes.
 */

export const CATEGORY_ICONS = {
  indexFund: {
    bg: "bg-blue-600",
    label: "Index Fund",
    svg: (
      <>
        {/* ascending bar chart */}
        <rect x="10" y="40" width="8" height="14" fill="#FFFFFF" />
        <rect x="22" y="32" width="8" height="22" fill="#FFFFFF" />
        <rect x="34" y="22" width="8" height="32" fill="#FFFFFF" />
        <rect x="46" y="14" width="8" height="40" fill="#FFFFFF" />
      </>
    ),
  } as AssetIcon,

  etf: {
    bg: "bg-cyan-600",
    label: "ETF",
    svg: (
      <>
        {/* stacked layers */}
        <path d="M32 12 L54 22 L32 32 L10 22 Z" fill="#FFFFFF" />
        <path d="M10 32 L32 42 L54 32" stroke="#FFFFFF" strokeWidth="3" fill="none" />
        <path d="M10 42 L32 52 L54 42" stroke="#FFFFFF" strokeWidth="3" fill="none" />
      </>
    ),
  } as AssetIcon,

  largeCap: {
    bg: "bg-blue-700",
    label: "Large Cap",
    svg: (
      <>
        {/* three large buildings */}
        <rect x="12" y="20" width="12" height="32" fill="#FFFFFF" />
        <rect x="26" y="12" width="14" height="40" fill="#FFFFFF" />
        <rect x="42" y="24" width="10" height="28" fill="#FFFFFF" />
        {/* windows on tallest */}
        <g fill="#1D4ED8">
          <rect x="29" y="18" width="2.5" height="2.5" />
          <rect x="34" y="18" width="2.5" height="2.5" />
          <rect x="29" y="24" width="2.5" height="2.5" />
          <rect x="34" y="24" width="2.5" height="2.5" />
          <rect x="29" y="30" width="2.5" height="2.5" />
          <rect x="34" y="30" width="2.5" height="2.5" />
        </g>
      </>
    ),
  } as AssetIcon,

  midCap: {
    bg: "bg-amber-500",
    text: "text-slate-950",
    label: "Mid Cap",
    svg: (
      <>
        {/* medium buildings */}
        <rect x="14" y="24" width="12" height="28" fill="#0F172A" />
        <rect x="28" y="18" width="12" height="34" fill="#0F172A" />
        <rect x="42" y="28" width="10" height="24" fill="#0F172A" />
      </>
    ),
  } as AssetIcon,

  smallCap: {
    bg: "bg-orange-600",
    label: "Small Cap",
    svg: (
      <>
        {/* soil mound */}
        <path d="M14 50 Q32 46 50 50 L50 54 L14 54 Z" fill="#FFFFFF" />
        {/* stem */}
        <line
          x1="32"
          y1="50"
          x2="32"
          y2="30"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* leaf left */}
        <path d="M32 34 Q22 32 20 24 Q28 22 32 30 Z" fill="#FFFFFF" />
        {/* leaf right */}
        <path d="M32 30 Q42 28 44 20 Q36 18 32 26 Z" fill="#FFFFFF" />
      </>
    ),
  } as AssetIcon,

  flexiCap: {
    bg: "bg-violet-600",
    label: "Flexi Cap",
    svg: (
      <>
        {/* two flexing arrows */}
        <path
          d="M14 22 L42 22 M42 22 L36 16 M42 22 L36 28"
          stroke="#FFFFFF"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M50 42 L22 42 M22 42 L28 36 M22 42 L28 48"
          stroke="#FFFFFF"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  } as AssetIcon,

  multiCap: {
    bg: "bg-violet-700",
    label: "Multi Cap",
    svg: (
      <>
        {/* three circles of varying sizes */}
        <circle cx="18" cy="34" r="6" fill="#FFFFFF" />
        <circle cx="34" cy="32" r="10" fill="#FFFFFF" />
        <circle cx="50" cy="36" r="5" fill="#FFFFFF" />
      </>
    ),
  } as AssetIcon,

  elss: {
    bg: "bg-emerald-700",
    label: "ELSS (Tax Saver)",
    svg: (
      <>
        {/* shield */}
        <path
          d="M32 10 L50 16 L50 32 Q50 46 32 54 Q14 46 14 32 L14 16 Z"
          fill="#FFFFFF"
        />
        {/* checkmark */}
        <path
          d="M22 32 L30 40 L44 24"
          stroke="#047857"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  } as AssetIcon,

  hybrid: {
    bg: "bg-purple-600",
    label: "Hybrid Fund",
    svg: (
      <>
        {/* center post */}
        <rect x="31" y="14" width="2" height="36" fill="#FFFFFF" />
        {/* arm */}
        <rect x="12" y="20" width="40" height="2" fill="#FFFFFF" />
        {/* left pan */}
        <path d="M12 22 L6 32 L18 32 Z" fill="#FFFFFF" />
        {/* right pan */}
        <path d="M52 22 L46 32 L58 32 Z" fill="#FFFFFF" />
        {/* base */}
        <rect x="22" y="48" width="20" height="3" fill="#FFFFFF" />
        <circle cx="32" cy="14" r="2" fill="#FFFFFF" />
      </>
    ),
  } as AssetIcon,

  liquid: {
    bg: "bg-sky-500",
    label: "Liquid Fund",
    svg: (
      <>
        {/* droplet */}
        <path
          d="M32 8 Q22 24 22 36 Q22 46 32 46 Q42 46 42 36 Q42 24 32 8 Z"
          fill="#FFFFFF"
        />
        {/* waves */}
        <path
          d="M10 54 Q16 50 22 54 T34 54 T46 54 T58 54"
          stroke="#FFFFFF"
          strokeWidth="2"
          fill="none"
        />
      </>
    ),
  } as AssetIcon,

  debt: {
    bg: "bg-emerald-700",
    label: "Debt Fund",
    svg: (
      <>
        {/* shield */}
        <path
          d="M32 10 L50 16 L50 32 Q50 46 32 54 Q14 46 14 32 L14 16 Z"
          fill="#FFFFFF"
        />
        {/* rupee */}
        <text
          x="32"
          y="38"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight="800"
          fontSize="20"
          fill="#047857"
        >
          ₹
        </text>
      </>
    ),
  } as AssetIcon,

  international: {
    bg: "bg-sky-600",
    label: "International Fund",
    svg: (
      <>
        <circle cx="32" cy="32" r="20" fill="none" stroke="#FFFFFF" strokeWidth="3" />
        <ellipse cx="32" cy="32" rx="10" ry="20" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <line x1="12" y1="32" x2="52" y2="32" stroke="#FFFFFF" strokeWidth="2" />
        <path
          d="M14 22 Q32 28 50 22"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M14 42 Q32 36 50 42"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          fill="none"
        />
      </>
    ),
  } as AssetIcon,

  sectoral: {
    bg: "bg-orange-500",
    label: "Sectoral Fund",
    svg: (
      <>
        {/* pie chart with one slice highlighted */}
        <circle cx="32" cy="32" r="20" fill="#FFFFFF" />
        <path d="M32 32 L32 12 A20 20 0 0 1 49.32 42 Z" fill="#C2410C" />
      </>
    ),
  } as AssetIcon,

  stock: {
    bg: "bg-emerald-600",
    label: "Stock",
    svg: (
      <>
        {/* candlestick chart */}
        <line x1="16" y1="14" x2="16" y2="50" stroke="#FFFFFF" strokeWidth="1.5" />
        <rect x="13" y="22" width="6" height="18" fill="#FFFFFF" />
        <line x1="28" y1="16" x2="28" y2="48" stroke="#FFFFFF" strokeWidth="1.5" />
        <rect x="25" y="20" width="6" height="14" fill="#FFFFFF" />
        <line x1="40" y1="12" x2="40" y2="46" stroke="#FFFFFF" strokeWidth="1.5" />
        <rect x="37" y="18" width="6" height="12" fill="#FFFFFF" />
        <line x1="50" y1="20" x2="50" y2="54" stroke="#FFFFFF" strokeWidth="1.5" />
        <rect x="47" y="26" width="6" height="20" fill="#FFFFFF" />
      </>
    ),
  } as AssetIcon,

  mutualFund: {
    bg: "bg-violet-600",
    label: "Mutual Fund",
    svg: (
      <>
        {/* pie chart */}
        <circle cx="32" cy="32" r="18" fill="#FFFFFF" />
        <path d="M32 32 L32 14 A18 18 0 0 1 47.59 41 Z" fill="#7C3AED" />
        <path
          d="M32 32 L47.59 41 A18 18 0 0 1 32 50 Z"
          fill="#C4B5FD"
        />
      </>
    ),
  } as AssetIcon,
} as const;
