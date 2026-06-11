import type { AssetIcon } from "./types";

/**
 * Asset-specific icons: gold, silver, bonds, real-estate, cash.
 * (Crypto lives in crypto.tsx — it uses react-icons.)
 *
 * All in-house SVG glyphs designed to be legible against the tile background.
 */

export const ASSET_ICONS = {
  goldBar: {
    bg: "bg-gradient-to-br from-amber-300 to-yellow-600",
    text: "text-slate-900",
    label: "Gold",
    svg: (
      <>
        {/* bottom bar */}
        <path
          d="M12 44 L52 44 L48 52 L16 52 Z"
          fill="rgba(0,0,0,0.12)"
          stroke="#7C2D12"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* middle bar */}
        <path
          d="M16 34 L48 34 L44 42 L20 42 Z"
          fill="rgba(255,255,255,0.18)"
          stroke="#7C2D12"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* top bar */}
        <path
          d="M20 24 L44 24 L42 32 L22 32 Z"
          fill="rgba(255,255,255,0.28)"
          stroke="#7C2D12"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* shine highlights */}
        <line x1="22" y1="26.5" x2="40" y2="26.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
        <line x1="18" y1="36.5" x2="44" y2="36.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
      </>
    ),
  } as AssetIcon,

  silverBar: {
    bg: "bg-gradient-to-br from-slate-200 to-slate-500",
    text: "text-slate-900",
    label: "Silver",
    svg: (
      <>
        <path
          d="M12 44 L52 44 L48 52 L16 52 Z"
          fill="rgba(0,0,0,0.12)"
          stroke="#1E293B"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M16 34 L48 34 L44 42 L20 42 Z"
          fill="rgba(255,255,255,0.3)"
          stroke="#1E293B"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M20 24 L44 24 L42 32 L22 32 Z"
          fill="rgba(255,255,255,0.4)"
          stroke="#1E293B"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line x1="22" y1="26.5" x2="40" y2="26.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
      </>
    ),
  } as AssetIcon,

  bonds: {
    bg: "bg-emerald-700",
    label: "Bonds",
    svg: (
      <>
        {/* certificate paper */}
        <rect x="12" y="14" width="40" height="40" rx="2" fill="#FFFFFF" />
        {/* header line */}
        <rect x="18" y="20" width="20" height="3" rx="1" fill="#047857" />
        {/* body lines */}
        <rect x="18" y="28" width="28" height="2" fill="#A7F3D0" />
        <rect x="18" y="34" width="28" height="2" fill="#A7F3D0" />
        {/* gold seal */}
        <circle cx="42" cy="44" r="6" fill="#F59E0B" />
        <path
          d="M38 48 L40 56 L42 52 L44 56 L46 48"
          stroke="#F59E0B"
          strokeWidth="2"
          fill="#F59E0B"
        />
      </>
    ),
  } as AssetIcon,

  realEstate: {
    bg: "bg-rose-600",
    label: "Real Estate",
    svg: (
      <>
        {/* main tower */}
        <rect x="20" y="14" width="24" height="38" fill="#FFFFFF" />
        {/* door */}
        <rect x="29" y="44" width="6" height="8" fill="#E11D48" />
        {/* windows */}
        <g fill="#E11D48">
          <rect x="23" y="18" width="3" height="3" />
          <rect x="29" y="18" width="3" height="3" />
          <rect x="35" y="18" width="3" height="3" />
          <rect x="38.5" y="18" width="3" height="3" />
          <rect x="23" y="24" width="3" height="3" />
          <rect x="29" y="24" width="3" height="3" />
          <rect x="35" y="24" width="3" height="3" />
          <rect x="38.5" y="24" width="3" height="3" />
          <rect x="23" y="30" width="3" height="3" />
          <rect x="29" y="30" width="3" height="3" />
          <rect x="35" y="30" width="3" height="3" />
          <rect x="38.5" y="30" width="3" height="3" />
          <rect x="23" y="36" width="3" height="3" />
          <rect x="38.5" y="36" width="3" height="3" />
        </g>
        {/* ground line */}
        <rect x="14" y="52" width="36" height="2" fill="#FFFFFF" />
      </>
    ),
  } as AssetIcon,

  cash: {
    bg: "bg-emerald-600",
    label: "Cash",
    svg: (
      <>
        {/* back note */}
        <rect x="10" y="20" width="40" height="18" rx="2" fill="#FFFFFF" opacity="0.85" />
        {/* front note */}
        <rect x="16" y="30" width="40" height="18" rx="2" fill="#FFFFFF" />
        {/* rupee on front note */}
        <text
          x="36"
          y="44"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight="700"
          fontSize="13"
          fill="#059669"
        >
          ₹
        </text>
      </>
    ),
  } as AssetIcon,

  emergencyFund: {
    bg: "bg-emerald-600",
    label: "Emergency Fund",
    svg: (
      <>
        {/* piggy bank body */}
        <ellipse cx="32" cy="34" rx="20" ry="14" fill="#FFFFFF" />
        {/* ear */}
        <path d="M44 22 L48 14 L48 22 Z" fill="#FFFFFF" />
        {/* leg L */}
        <rect x="18" y="46" width="4" height="6" fill="#FFFFFF" />
        {/* leg R */}
        <rect x="42" y="46" width="4" height="6" fill="#FFFFFF" />
        {/* slot */}
        <rect x="28" y="22" width="10" height="2" fill="#059669" />
        {/* eye */}
        <circle cx="40" cy="30" r="1.5" fill="#059669" />
        {/* coin */}
        <circle cx="32" cy="14" r="3" fill="#FBBF24" />
      </>
    ),
  } as AssetIcon,
} as const;
