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
          <div className="rounded-md bg-white/5 p-3">
            <p className="text-xs text-muted-foreground">Allocation</p>
            <p className="mt-1 font-semibold text-white">{rec.suggestedAllocation}%</p>
          </div>
          <div className="rounded-md bg-white/5 p-3">
            <p className="text-xs text-muted-foreground">Monthly</p>
            <p className="mt-1 font-semibold text-white">{inr(rec.suggestedMonthlyAmount)}</p>
          </div>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>Confidence score</span>
            <span>{rec.confidenceScore}%</span>
          </div>
          <Progress value={rec.confidenceScore} />
        </div>
        <p className="text-sm leading-6 text-slate-300">{rec.reasoning}</p>
        {!compact ? (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p><span className="text-slate-200">Entry:</span> {rec.entryTiming}</p>
            {rec.exitTiming ? <p><span className="text-slate-200">Exit:</span> {rec.exitTiming}</p> : null}
            <p><span className="text-slate-200">What can go wrong:</span> {rec.whatCanGoWrong}</p>
            <p><span className="text-slate-200">Suitable for:</span> {rec.suitableFor}</p>
            <p><span className="text-slate-200">Time horizon:</span> {rec.timeHorizon}</p>
            <p><span className="text-slate-200">Review when:</span> {rec.reviewCondition}</p>
            <p><span className="text-slate-200">Base case:</span> {rec.scenarioProjection.base}</p>
            {rec.sourceLinks.length ? (
              <div>
                <p className="text-slate-200">Sources:</p>
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
