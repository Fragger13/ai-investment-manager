import { LucideIcon } from "lucide-react";
import { ColorfulIcon, IconAccent } from "@/components/colorful-icon";
import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({ label, value, detail, icon, accent = "cyan" }: { label: string; value: string; detail: string; icon: LucideIcon; accent?: IconAccent }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
          </div>
          <ColorfulIcon icon={icon} accent={accent} label={label} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
