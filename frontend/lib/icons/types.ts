import type { ComponentType, ReactNode } from "react";

export type IconSize = "sm" | "md" | "lg" | "xl";

/**
 * A resolved icon for an asset / fund / sector / action.
 *
 * Exactly one of `svg`, `Element`, or `symbol` is rendered inside an
 * AssetTile sized to `IconSize`.
 *
 * - `svg`     — children of a 64×64 viewBox SVG (used for in-house artwork)
 * - `src`     — local public asset path (used for imported logos / static icons)
 * - `Element` — React component (e.g., react-icons or lucide) sized at ~55% of tile
 * - `symbol`  — short text glyph rendered at ~60% of tile (e.g., ₿, Ξ)
 *
 * The tile background is set via `bg` (any tailwind class — supports gradients
 * like "bg-gradient-to-br from-amber-300 to-yellow-600").
 */
export type AssetIcon = {
  bg: string;
  text?: string;
  label: string;
  src?: string;
  svg?: ReactNode;
  Element?: ComponentType<{ size?: number; className?: string }>;
  symbol?: string;
};
