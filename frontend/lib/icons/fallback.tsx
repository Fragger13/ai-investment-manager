import type { AssetIcon } from "./types";

/**
 * Generic fallback icon — used when nothing else matches.
 * Avoid relying on this in production; expand the resolver instead.
 */
export const FALLBACK_ICON: AssetIcon = {
  bg: "bg-slate-500",
  label: "Investment",
  svg: (
    <>
      {/* wallet */}
      <rect x="10" y="20" width="44" height="28" rx="4" fill="#FFFFFF" />
      <path d="M10 24 Q10 18 16 18 L40 18 L40 24 Z" fill="#FFFFFF" />
      <circle cx="42" cy="34" r="3" fill="#475569" />
    </>
  ),
};
