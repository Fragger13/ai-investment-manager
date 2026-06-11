"use client";

import { cn } from "@/lib/utils";
import type { AssetIcon, IconSize } from "./types";

const DIMS: Record<IconSize, { px: number; rounded: string }> = {
  sm: { px: 36, rounded: "rounded-xl" },
  md: { px: 44, rounded: "rounded-xl" },
  lg: { px: 48, rounded: "rounded-2xl" },
  xl: { px: 64, rounded: "rounded-2xl" },
};

export function AssetTile({
  icon,
  size,
  className,
}: {
  icon: AssetIcon;
  size: IconSize;
  className?: string;
}) {
  const { px, rounded } = DIMS[size];
  const elementSize = Math.round(px * 0.55);
  const symbolSize = Math.round(px * 0.6);

  return (
    <span
      aria-label={icon.label}
      title={icon.label}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden shadow-sm",
        rounded,
        icon.bg,
        icon.text ?? "text-white",
        className,
      )}
      style={{ width: px, height: px }}
    >
      {icon.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon.src}
          alt=""
          aria-hidden="true"
          className="h-[88%] w-[88%] object-contain"
          loading="lazy"
        />
      ) : icon.svg ? (
        <svg viewBox="0 0 64 64" width={px} height={px} aria-hidden="true">
          {icon.svg}
        </svg>
      ) : icon.Element ? (
        <icon.Element size={elementSize} className="block" />
      ) : icon.symbol ? (
        <span className="font-bold leading-none" style={{ fontSize: symbolSize }}>
          {icon.symbol}
        </span>
      ) : null}
    </span>
  );
}
