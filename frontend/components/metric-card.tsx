import { LucideIcon } from "lucide-react";
import { ColorfulIcon, IconAccent } from "@/components/colorful-icon";
import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({ label, value, detail, icon, accent = "cyan" }: { label: string; value: string; detail: string; icon: LucideIcon; accent?: IconAccent }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="ap-eyebrow">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tnum">{value}</p>
          </div>
          <ColorfulIcon icon={icon} accent={accent} label={label} />
        </div>
        <p className="ap-help mt-2">{detail}</p>
      </CardContent>
    </Card>
  );
}
