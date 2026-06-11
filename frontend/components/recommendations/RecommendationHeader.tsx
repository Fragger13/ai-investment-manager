"use client";

import { AlertTriangle, Scale, ShieldCheck } from "lucide-react";
import { ColorfulIcon } from "@/components/colorful-icon";
import { assetIconSpec } from "@/lib/icon-maps";
import type { RiskLevel } from "@/types";

type RecommendationHeaderProps = {
  instrumentName: string;
  ticker?: string;
  assetType: string;
  riskLevel: RiskLevel;
  strategyBucket?: string;
  recommendationType?: string;
};

const riskStyles: Record<RiskLevel, string> = {
  Low: "border-positive/35 bg-positive-soft text-positive-foreground shadow-sm",
  Medium: "border-warning/35 bg-warning-soft text-warning-foreground shadow-sm",
  High: "border-negative/35 bg-negative-soft text-negative-foreground shadow-sm",
};

export function RecommendationHeader({ instrumentName, ticker, assetType, riskLevel, strategyBucket, recommendationType }: RecommendationHeaderProps) {
  const asset = assetIconSpec(`${instrumentName} ${assetType} ${strategyBucket || ""} ${recommendationType || ""}`);

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <ColorfulIcon icon={asset.icon} accent={asset.accent} label={asset.label} size="lg" className="mt-0.5" />
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-lg font-semibold leading-6 text-foreground">
            {instrumentName}{ticker ? ` (${ticker})` : ""}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{assetType}</p>
        </div>
      </div>
      <RiskBadge risk={riskLevel} />
    </div>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const Icon = risk === "High" ? AlertTriangle : risk === "Medium" ? Scale : ShieldCheck;
  return (
    <span className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${riskStyles[risk]}`} aria-label={`${risk} risk`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {risk} risk
    </span>
  );
}
