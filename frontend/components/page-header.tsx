import { Badge } from "@/components/ui/badge";

export function PageHeader({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        {badge ? <Badge tone="good" className="mb-3">{badge}</Badge> : null}
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
