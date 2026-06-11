"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, LlmEnhancementStatusResponse } from "@/lib/api";

export default function LlmEnhancementsDebugPage() {
  const [status, setStatus] = useState<LlmEnhancementStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setStatus(await api.llmEnhancementStatus(undefined, true));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, []);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <AppShell>
      <PageHeader title="LLM Enhancements" subtitle="Development-only lifecycle view for background Qwen copy generation." badge="Dev only" />
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{status?.total || 0} tracked</Badge>
            <Badge tone="neutral">{status?.queued || 0} queued</Badge>
            <Badge tone="neutral">{status?.processing || 0} processing</Badge>
            <Badge tone="good">{status?.completed || 0} completed</Badge>
            <Badge tone="warn">{status?.fallback || 0} fallback</Badge>
            <Badge tone="warn">{status?.failed || 0} failed</Badge>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </CardContent>
      </Card>
      <div className="mt-4 overflow-x-auto rounded-md border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-soft text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Item</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Enhanced</th>
              <th className="px-3 py-3">Attempts</th>
              <th className="px-3 py-3">Fallback reason</th>
              <th className="px-3 py-3">Generated</th>
            </tr>
          </thead>
          <tbody>
            {(status?.items || []).map((item) => (
              <tr key={`${item.itemType}-${item.itemId}`} className="border-t border-border text-foreground/80">
                <td className="px-3 py-3">{item.itemType}</td>
                <td className="max-w-[20rem] truncate px-3 py-3">{item.itemId}</td>
                <td className="px-3 py-3">{item.status}</td>
                <td className="px-3 py-3">{item.enhanced ? "Yes" : "No"}</td>
                <td className="px-3 py-3">{item.attemptCount}</td>
                <td className="px-3 py-3">{item.fallbackReason || item.lastError || "-"}</td>
                <td className="px-3 py-3">{item.generatedAt || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
