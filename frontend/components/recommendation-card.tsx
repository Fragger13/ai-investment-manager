import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Recommendation } from "@/types";
import { inr } from "@/lib/utils";

export function RecommendationCard({ rec, compact = false }: { rec: Recommendation; compact?: boolean }) {
  const tone = rec.riskLevel === "High" ? "danger" : rec.riskLevel === "Medium" ? "warn" : "good";
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{rec.assetClass}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{rec.strategyType}</p>
          </div>
          <Badge tone={tone}>{rec.riskLevel} risk</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-surface-soft p-3">
            <p className="text-xs text-muted-foreground">Suggested share</p>
            <p className="mt-1 font-semibold text-foreground">{rec.suggestedAllocation}%</p>
          </div>
          <div className="rounded-md bg-surface-soft p-3">
            <p className="text-xs text-muted-foreground">Monthly</p>
            <p className="mt-1 font-semibold text-foreground">{inr(rec.suggestedMonthlyAmount)}</p>
          </div>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>Confidence level</span>
            <span>{rec.confidenceScore}%</span>
          </div>
          <Progress value={rec.confidenceScore} />
        </div>
        <p className="text-sm leading-6 text-foreground/80">{rec.reasoning}</p>
        {rec.specificFunds && rec.specificFunds.length ? (
          <div className="rounded-md border border-border/60 bg-surface-soft p-3">
            <p className="text-xs font-medium text-foreground/90">Specific funds to consider (Direct plans, ranked by past returns)</p>
            <ul className="mt-2 space-y-2">
              {rec.specificFunds.map((fund, idx) => (
                <li key={fund.schemeCode || fund.name} className="text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-foreground">
                      {idx === 0 ? "★ " : ""}{fund.name}
                    </span>
                    {fund.rankReturn != null && fund.rankBasis ? (
                      <span className="shrink-0 text-xs font-semibold text-primary">
                        {fund.rankReturn.toFixed(1)}% <span className="font-normal text-muted-foreground">{fund.rankBasis}</span>
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {fund.plan}
                    {fund.return1y != null ? ` · 1Y ${fund.return1y.toFixed(1)}%` : ""}
                    {fund.return3y != null ? ` · 3Y ${fund.return3y.toFixed(1)}%` : ""}
                    {fund.return5y != null ? ` · 5Y ${fund.return5y.toFixed(1)}%` : ""}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">Past returns don&apos;t guarantee future results. Returns are net of expenses (NAV-based).</p>
          </div>
        ) : null}
        {!compact ? (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p><span className="text-foreground/90">When to consider starting:</span> {rec.entryTiming}</p>
            {rec.exitTiming ? <p><span className="text-foreground/90">When to consider stopping:</span> {rec.exitTiming}</p> : null}
            <p><span className="text-foreground/90">What to be careful about:</span> {rec.whatCanGoWrong}</p>
            <p><span className="text-foreground/90">Suitable for:</span> {rec.suitableFor}</p>
            <p><span className="text-foreground/90">Time horizon:</span> {rec.timeHorizon}</p>
            <p><span className="text-foreground/90">Review when:</span> {rec.reviewCondition}</p>
            <p><span className="text-foreground/90">Most likely scenario:</span> {rec.scenarioProjection.base}</p>
            {rec.sourceLinks.length ? (
              <div>
                <p className="text-foreground/90">Sources:</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {rec.sourceLinks.map((source) => (
                    <a key={`${rec.id}-${source.name}`} className="text-primary underline-offset-4 hover:underline" href={source.url} target="_blank" rel="noreferrer">{source.name}</a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
