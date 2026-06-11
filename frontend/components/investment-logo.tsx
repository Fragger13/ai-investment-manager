"use client";

import { AssetTile, resolveAssetIcon, type IconSize } from "@/lib/icons";

/**
 * Thin wrapper around the icon library.
 *
 * Resolves the right icon for a fund / asset / action via the central
 * dispatcher and renders it inside an AssetTile.
 *
 * `extraHint` is optional context concatenated into the resolver input — pass
 * the original instrument name here when the display `name` was simplified
 * and may no longer carry the AMC keyword (e.g. "Increase Nifty Index SIP").
 */
export function InvestmentLogo({
  name,
  category = "",
  ticker = "",
  extraHint = "",
  size = "lg",
  className,
}: {
  name: string;
  category?: string;
  ticker?: string;
  extraHint?: string;
  size?: IconSize;
  className?: string;
}) {
  const icon = resolveAssetIcon({ name: `${name} ${extraHint}`.trim(), category, ticker });
  return <AssetTile icon={icon} size={size} className={className} />;
}
