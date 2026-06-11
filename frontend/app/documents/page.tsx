"use client";

import { useState } from "react";
import { FileCheck2, FileSearch, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ExpenseChart } from "@/components/charts";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { mergeProfilePatch } from "@/lib/profile";
import { inr } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { DocumentAnalysis } from "@/types";

export default function DocumentsPage() {
  const profile = useAuthStore((state) => state.profile);
  const saveProfile = useAuthStore((state) => state.saveProfile);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function upload(file?: File) {
    if (!file) return;
    setError("");
    setProgress(30);
    try {
      setProgress(70);
      const result = await api.uploadDocument(file);
      setAnalysis(result);
      setProgress(100);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
      setProgress(0);
    }
  }

  function saveExtractedValues() {
    if (!analysis || !profile) return;
    saveProfile(mergeProfilePatch(profile, analysis.profilePatch), false);
  }

  return (
    <AppShell>
      <PageHeader
        title="Document Upload & Review"
        subtitle="Upload PDF, CSV, or XLSX files so the app can extract income, expenses, EMIs, investments, and recurring payments for your review."
        badge="Review imported details"
      />

      {analysis ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Import status" value={analysis.summary.extractionStatus} detail={`${analysis.summary.confidence}% confidence`} icon={FileCheck2} />
          <MetricCard label="Detected income" value={inr(analysis.summary.detectedIncome)} detail="Payments that appear to be income" icon={FileSearch} />
          <MetricCard label="Recurring spending" value={inr(analysis.summary.recurringExpenses)} detail={`${analysis.summary.subscriptions} subscriptions found`} icon={UploadCloud} />
          <MetricCard label="Net worth found" value={inr(analysis.summary.netWorthExtracted)} detail="From lines that appear to show investments" icon={FileCheck2} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
        <Card>
          <CardHeader><CardTitle>Upload a Document</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/[0.08] p-6 text-center">
              <UploadCloud className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 text-sm font-medium text-foreground">Bank statements, salary slips, brokerage statements, mutual fund reports, P/L statements, and tax documents</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">PDF, CSV, and XLSX files are supported. Image reading is coming soon.</p>
            </div>
            <Input type="file" accept=".pdf,.csv,.xlsx,.xls" onChange={(event) => upload(event.target.files?.[0])} />
            {progress ? <Progress value={progress} /> : null}
            {error ? <p className="text-sm text-negative-foreground">{error}</p> : null}
            {analysis && profile ? <Button onClick={saveExtractedValues}>Save imported values to profile draft</Button> : null}
            {analysis && !profile ? <p className="text-sm text-warning-foreground">Complete onboarding first, then save imported values to your profile.</p> : null}
          </CardContent>
        </Card>
        <ExpenseChart data={analysis?.extractedCategories || []} />
      </div>

      {analysis ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Imported Details To Review</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {analysis.extractedFields.map((field) => (
                <div key={field.field} className="rounded-md border border-border bg-surface-soft p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{field.label}</p>
                    <Badge tone={field.status === "Needs your review" ? "warn" : "good"}>{field.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-foreground/80">{String(field.value || "No value found")}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{field.explanation}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Import confidence: {field.confidence}%</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>What We Found</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Import confidence</span><span>{analysis.summary.confidence}%</span></div>
                <Progress value={analysis.summary.confidence} />
              </div>
              {analysis.documents.map((doc) => (
                <div key={doc.type} className="rounded-md bg-surface-soft p-3 text-sm leading-6 text-foreground/80">{doc.insight}</div>
              ))}
              {analysis.aiFindings.map((finding) => (
                <div key={finding} className="rounded-md bg-surface-soft p-3 text-sm leading-6 text-foreground/80">{finding}</div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
