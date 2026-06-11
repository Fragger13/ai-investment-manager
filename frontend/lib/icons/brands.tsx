import type { AssetIcon } from "./types";

/**
 * Fund-house brand marks.
 *
 * These are stylised geometric monograms (brand-coloured tile + simplified
 * initial + accent shape) — original designs inspired by each fund house's
 * visual identity. They are NOT reproductions of the official trademarks
 * and are intended as recognisable in-app badges, not legal substitutes
 * for the AMC's registered marks.
 */
export type BrandKey =
  | "sbi"
  | "hdfc"
  | "icici"
  | "axis"
  | "kotak"
  | "nippon"
  | "mirae"
  | "tata"
  | "birla"
  | "quant"
  | "motilal"
  | "uti"
  | "dsp"
  | "ppfas"
  | "edelweiss"
  | "zerodha"
  | "groww";

export const BRAND_MATCHERS: { match: RegExp; key: BrandKey }[] = [
  { match: /\bsbi\b|state bank/i, key: "sbi" },
  { match: /\bhdfc\b/i, key: "hdfc" },
  { match: /\bicici\b/i, key: "icici" },
  { match: /\baxis\b/i, key: "axis" },
  { match: /\bkotak\b/i, key: "kotak" },
  { match: /\bnippon\b/i, key: "nippon" },
  { match: /\bmirae\b/i, key: "mirae" },
  { match: /\btata\b/i, key: "tata" },
  { match: /aditya|birla/i, key: "birla" },
  { match: /\bquant\b/i, key: "quant" },
  { match: /motilal|oswal/i, key: "motilal" },
  { match: /\buti\b/i, key: "uti" },
  { match: /\bdsp\b/i, key: "dsp" },
  { match: /\bppfas\b|parag parikh/i, key: "ppfas" },
  { match: /\bedelweiss\b/i, key: "edelweiss" },
  { match: /\bzerodha\b/i, key: "zerodha" },
  { match: /\bgroww\b/i, key: "groww" },
];

export const BRAND_ICONS: Record<BrandKey, AssetIcon> = {
  sbi: {
    bg: "bg-[#0F3D8A]",
    label: "SBI Mutual Fund",
    svg: (
      <>
        <circle cx="32" cy="26" r="9" fill="none" stroke="#FFFFFF" strokeWidth="3.2" />
        <path d="M27 33 L37 33 L34 47 L30 47 Z" fill="#FFFFFF" />
      </>
    ),
  },
  hdfc: {
    bg: "bg-[#06286B]",
    label: "HDFC Mutual Fund",
    svg: (
      <>
        <rect x="10" y="14" width="6" height="36" fill="#FFFFFF" />
        <rect x="48" y="14" width="6" height="36" fill="#FFFFFF" />
        <rect x="10" y="29" width="44" height="6" fill="#FFFFFF" />
        <rect x="14" y="50" width="36" height="3" fill="#ED2024" />
      </>
    ),
  },
  icici: {
    bg: "bg-[#F37920]",
    label: "ICICI Prudential",
    svg: (
      <>
        <rect x="14" y="14" width="6" height="36" fill="#FFFFFF" />
        <rect x="44" y="14" width="6" height="36" fill="#FFFFFF" />
        <path
          d="M24 32 Q32 22 40 32 T 56 32"
          fill="none"
          stroke="#A82400"
          strokeWidth="2.5"
        />
      </>
    ),
  },
  axis: {
    bg: "bg-[#97144D]",
    label: "Axis Mutual Fund",
    svg: (
      <>
        <path
          d="M32 14 L20 50 L26 50 L29 41 L35 41 L38 50 L44 50 Z M30.5 35 L33.5 35 L32 30 Z"
          fill="#FFFFFF"
        />
        <path
          d="M44 18 L52 18 L52 26"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M44 26 L52 18"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
  },
  kotak: {
    bg: "bg-[#ED1C24]",
    label: "Kotak Mahindra Mutual Fund",
    svg: (
      <>
        <path
          d="M20 14 L26 14 L26 30 L42 14 L50 14 L34 30 L50 50 L42 50 L26 32 L26 50 L20 50 Z"
          fill="#FFFFFF"
        />
        <circle cx="50" cy="50" r="3.5" fill="#FFC72C" />
      </>
    ),
  },
  nippon: {
    bg: "bg-[#C8102E]",
    label: "Nippon India Mutual Fund",
    svg: (
      <>
        <circle cx="50" cy="18" r="6" fill="#FFFFFF" opacity="0.95" />
        <path
          d="M16 50 L16 18 L21 18 L40 42 L40 18 L46 18 L46 50 L41 50 L22 26 L22 50 Z"
          fill="#FFFFFF"
        />
      </>
    ),
  },
  mirae: {
    bg: "bg-[#00754A]",
    label: "Mirae Asset",
    svg: (
      <>
        <path
          d="M14 50 L14 14 L20 14 L32 36 L44 14 L50 14 L50 50 L44 50 L44 26 L34 44 L30 44 L20 26 L20 50 Z"
          fill="#FFFFFF"
        />
        <rect x="14" y="52" width="36" height="3" fill="#FFC72C" />
      </>
    ),
  },
  tata: {
    bg: "bg-[#003B7E]",
    label: "Tata Mutual Fund",
    svg: (
      <path
        d="M14 16 L50 16 L50 24 L36 24 L36 50 L28 50 L28 24 L14 24 Z"
        fill="#FFFFFF"
      />
    ),
  },
  birla: {
    bg: "bg-[#F47B20]",
    label: "Aditya Birla Sun Life",
    svg: (
      <>
        <path
          d="M14 50 L24 16 L30 16 L40 50 L34 50 L32 42 L22 42 L20 50 Z M24 36 L30 36 L27 24 Z"
          fill="#FFFFFF"
        />
        <text
          x="44"
          y="44"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight="800"
          fontSize="16"
          fill="#FFFFFF"
        >
          B
        </text>
        <circle cx="32" cy="54" r="2.5" fill="#FFFFFF" />
      </>
    ),
  },
  quant: {
    bg: "bg-[#6E27B5]",
    label: "Quant Mutual Fund",
    svg: (
      <>
        <circle
          cx="32"
          cy="32"
          r="14"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="4"
        />
        <line
          x1="40"
          y1="40"
          x2="50"
          y2="50"
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="50" cy="14" r="3.5" fill="#FFC72C" />
      </>
    ),
  },
  motilal: {
    bg: "bg-[#F8B500]",
    text: "text-slate-950",
    label: "Motilal Oswal",
    svg: (
      <>
        <path
          d="M10 50 L10 14 L16 14 L23 32 L30 14 L36 14 L36 50 L30 50 L30 28 L25 40 L21 40 L16 28 L16 50 Z"
          fill="#0A1F44"
        />
        <circle
          cx="48"
          cy="32"
          r="12"
          fill="none"
          stroke="#0A1F44"
          strokeWidth="4"
        />
        <path
          d="M40 50 L56 50"
          stroke="#0A1F44"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
  },
  uti: {
    bg: "bg-[#0072B5]",
    label: "UTI Mutual Fund",
    svg: (
      <>
        <path
          d="M12 14 L18 14 L18 32 Q18 40 24 40 Q30 40 30 32 L30 14 L36 14 L36 32 Q36 46 24 46 Q12 46 12 32 Z"
          fill="#FFFFFF"
        />
        <path
          d="M38 14 L60 14 L60 20 L52 20 L52 46 L46 46 L46 20 L38 20 Z"
          fill="#FFFFFF"
        />
        <circle cx="32" cy="54" r="3" fill="#FFC72C" />
      </>
    ),
  },
  dsp: {
    bg: "bg-[#1B2D6B]",
    label: "DSP Mutual Fund",
    svg: (
      <>
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight="800"
          fontSize="22"
          fill="#FFFFFF"
          letterSpacing="-1"
        >
          DSP
        </text>
        <rect x="14" y="46" width="36" height="3" fill="#FF6B00" />
      </>
    ),
  },
  ppfas: {
    bg: "bg-[#0C5C3C]",
    label: "Parag Parikh Financial Advisory Services",
    svg: (
      <>
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight="800"
          fontSize="22"
          fill="#FFFFFF"
        >
          PP
        </text>
        <path d="M48 14 Q56 14 56 22 Q56 18 48 18 Z" fill="#FFC72C" />
      </>
    ),
  },
  edelweiss: {
    bg: "bg-[#5B2D90]",
    label: "Edelweiss Mutual Fund",
    svg: (
      <>
        <text
          x="32"
          y="42"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight="800"
          fontSize="22"
          fill="#FFFFFF"
        >
          EW
        </text>
        <circle cx="14" cy="14" r="4" fill="#FFFFFF" />
        <circle cx="14" cy="14" r="2" fill="#FFC72C" />
      </>
    ),
  },
  zerodha: {
    bg: "bg-[#387ED1]",
    label: "Zerodha",
    svg: (
      <path
        d="M16 14 L48 14 L48 22 L26 44 L48 44 L48 50 L16 50 L16 42 L38 20 L16 20 Z"
        fill="#FFFFFF"
      />
    ),
  },
  groww: {
    bg: "bg-[#00B386]",
    label: "Groww",
    svg: (
      <path
        d="M44 18 Q24 14 16 32 Q16 50 36 50 Q48 50 48 38 L48 30 L34 30 L34 36 L42 36 Q40 44 32 44 Q22 44 22 32 Q22 20 34 20 Q40 20 44 24 Z"
        fill="#FFFFFF"
      />
    ),
  },
};
