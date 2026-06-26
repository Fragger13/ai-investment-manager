"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, IndianRupee, Sparkles, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvestmentLogo } from "@/components/investment-logo";
import { Badge } from "@/components/ui/badge";
import { usePlanActionsStore } from "@/store/plan-actions-store";
import { useAuthStore } from "@/store/auth-store";
import { api } from "@/lib/api";
import { cn, inr } from "@/lib/utils";

export type ActionKind =
  | "fund"            // start/boost an SIP — amount + start + (optional end)
  | "lump_sum"        // single transfer to a goal or fund (e.g., catch-up boost, emergency seed)
  | "habit"           // behavioral change — no amount, optional commitment date
  | "debt"            // debt-related — show outstanding/EMI and "stop new debt" checklist
  | "review";         // review/rebalance — just confirm + add note

export type TakeActionPayload = {
  key: string;
  instrumentName: string;
  category: string;
  ticker: string;
  suggestedMonthlyAmount: number;
  actionLabel: string;
  reason?: string;
  expectedReturn?: string;
  risk?: string;
  // Hints
  kind?: ActionKind;
  goalName?: string;
};

export function TakeActionDialog({ payload, trigger, autoOpen, onOpenChange }: { payload: TakeActionPayload; trigger?: React.ReactNode; autoOpen?: boolean; onOpenChange?: (open: boolean) => void }) {
  const recordAction = usePlanActionsStore((state) => state.recordAction);
  const removeAction = usePlanActionsStore((state) => state.removeAction);
  const existing = usePlanActionsStore((state) => state.actionFor(payload.key));
  const profile = useAuthStore((state) => state.profile);
  const token = useAuthStore((state) => state.token);
  const saveProfile = useAuthStore((state) => state.saveProfile);
  const onboardingComplete = useAuthStore((state) => state.onboardingComplete);
  // An investment can be started either way; the SIP/lump-sum toggle picks which.
  const baseKind: ActionKind = payload.kind || inferKind(payload);
  const investable = baseKind === "fund" || baseKind === "lump_sum";

  // The saved goal this recommendation funds (if any) — drives the opt-out
  // "Add to my {goal} goal" checkbox and the auto-link on submit.
  const linkGoal = useMemo(() => {
    if (!payload.goalName || !profile?.goals?.length) return null;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const target = norm(payload.goalName);
    if (!target) return null;
    const index = profile.goals.findIndex((g) => {
      const name = norm((g.type === "Other" ? g.customName : g.type) || "");
      return Boolean(name) && (name === target || name.includes(target) || target.includes(name));
    });
    return index >= 0 ? { index, name: payload.goalName } : null;
  }, [payload.goalName, profile]);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(existing?.amount || payload.suggestedMonthlyAmount || 0);
  const [startDate, setStartDate] = useState(existing?.startDate || todayIso());
  const [endDate, setEndDate] = useState(existing?.endDate || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [commit, setCommit] = useState<string[]>([]);
  const [linkToGoal, setLinkToGoal] = useState(true);
  const [mode, setMode] = useState<"sip" | "lumpsum">(existing?.cadence === "one_time" || baseKind === "lump_sum" ? "lumpsum" : "sip");
  const [submitted, setSubmitted] = useState(false);

  // Effective kind: a chosen lump sum behaves like a one-time contribution, a
  // chosen SIP like a recurring fund. Non-investment actions keep their kind.
  const kind: ActionKind = investable ? (mode === "lumpsum" ? "lump_sum" : "fund") : baseKind;
  const fields = useMemo(() => fieldsFor(kind), [kind]);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    if (open) {
      setAmount(existing?.amount || payload.suggestedMonthlyAmount || 0);
      setStartDate(existing?.startDate || todayIso());
      setEndDate(existing?.endDate || "");
      setNotes(existing?.notes || "");
      setCommit([]);
      setLinkToGoal(true);
      setMode(existing?.cadence === "one_time" || baseKind === "lump_sum" ? "lumpsum" : "sip");
      setSubmitted(false);
    }
    onOpenChange?.(open);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCommit(value: string) {
    setCommit((current) => current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
  }

  function handleSubmit() {
    const checklistNote = commit.length ? `Committed to: ${commit.join("; ")}` : "";
    const composedNotes = [notes, checklistNote].filter(Boolean).join(" — ");
    recordAction({
      key: payload.key,
      instrumentName: payload.instrumentName,
      category: payload.category,
      ticker: payload.ticker,
      amount: fields.showAmount ? amount : 0,
      startDate: fields.showStart ? startDate : "",
      endDate: fields.showEnd ? endDate : "",
      actionType: payload.actionLabel.toLowerCase().includes("watch") ? "watching" : "took_action",
      notes: composedNotes,
      cadence: kind === "lump_sum" ? "one_time" : "monthly",
      goalName: payload.goalName,
    });
    // Auto-link the resulting holding to its goal (unless the user opted out).
    // Holding id mirrors the backend's synthesized `action-{key}` so it resolves
    // in the goal's linked holdings + the backend goal credit.
    if (linkGoal && linkToGoal && fields.showAmount && amount > 0 && profile) {
      const holdingId = `action-${payload.key}`;
      const goals = [...(profile.goals || [])];
      const target = goals[linkGoal.index];
      if (target && !(target.linkedHoldingIds || []).includes(holdingId)) {
        goals[linkGoal.index] = { ...target, linkedHoldingIds: [...(target.linkedHoldingIds || []), holdingId] };
        const next = { ...profile, goals };
        saveProfile(next, onboardingComplete);
        api.saveOnboarding(next, token, { partial: true }).catch(() => null);
      }
    }
    setSubmitted(true);
  }

  function handleRemove() {
    removeAction(payload.key);
    setOpen(false);
  }

  const canSubmit = fields.showAmount ? amount > 0 : (kind === "habit" ? commit.length > 0 || notes.length > 0 : true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] w-[min(620px,94vw)] overflow-y-auto p-0">
        <div className="border-b border-border px-6 py-5 pr-12">
          <div className="flex items-center gap-3">
            <InvestmentLogo name={payload.instrumentName} category={payload.category} ticker={payload.ticker} size="md" />
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-foreground">{payload.instrumentName}</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">{titleFor(kind, payload)}</DialogDescription>
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="p-6">
            <div className="rounded-2xl bg-positive-soft p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-positive-foreground" />
              <p className="mt-3 text-base font-semibold text-foreground">{successHeadlineFor(kind)}</p>
              <p className="mt-1 text-sm text-muted-foreground">We&apos;ll track this in your plan and let you know if anything changes that affects this decision.</p>
            </div>
            {fields.showAmount ? (
              <div className={cn("mt-4 grid gap-3 text-sm", kind === "lump_sum" ? "grid-cols-2" : "grid-cols-3")}>
                <Summary label={kind === "lump_sum" ? "Amount (one-time)" : amountLabel(kind, true)} value={inr(amount)} />
                <Summary label={kind === "lump_sum" ? "Date" : "Start"} value={formatDate(startDate)} />
                {kind !== "lump_sum" ? <Summary label="End" value={endDate ? formatDate(endDate) : "Open-ended"} /> : null}
              </div>
            ) : kind === "habit" ? (
              <div className="mt-4 rounded-xl bg-surface-soft p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Committed to</p>
                <p className="mt-1 text-foreground">{commit.length ? commit.join(", ") : (notes || "Behavioral change recorded")}</p>
              </div>
            ) : null}
            <Button className="mt-5 w-full" onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-sm font-semibold text-foreground">Action: {payload.actionLabel}</p>
            {payload.reason ? <p className="mt-1 text-sm text-muted-foreground">{payload.reason}</p> : null}

            {(payload.expectedReturn || payload.risk) && fields.showInvestmentMeta ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {payload.expectedReturn ? (
                  <div className="rounded-xl border border-border bg-surface-soft p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Est. return</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{payload.expectedReturn}</p>
                  </div>
                ) : null}
                {payload.risk ? (
                  <div className="rounded-xl border border-border bg-surface-soft p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Risk</p>
                    <p className="mt-1"><Badge tone={payload.risk === "Low" ? "good" : payload.risk === "High" ? "danger" : "warn"}>{payload.risk}</Badge></p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              {investable ? (
                <div>
                  <Label className="text-sm font-medium text-foreground">How do you want to invest?</Label>
                  <div className="mt-1.5 flex gap-1 rounded-lg border border-input bg-surface-soft p-1">
                    <button
                      type="button"
                      onClick={() => setMode("sip")}
                      aria-pressed={mode === "sip"}
                      className={cn("flex-1 rounded-md px-3 py-2 text-sm font-semibold transition", mode === "sip" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      Monthly SIP
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("lumpsum")}
                      aria-pressed={mode === "lumpsum"}
                      className={cn("flex-1 rounded-md px-3 py-2 text-sm font-semibold transition", mode === "lumpsum" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      One-time lump sum
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {mode === "lumpsum" ? "A single one-time investment — it won't reduce your monthly budget." : "A fixed amount invested automatically every month."}
                  </p>
                </div>
              ) : null}

              {fields.showAmount ? (
                <div>
                  <Label htmlFor="ta-amount" className="text-sm font-medium text-foreground">{amountLabel(kind)}</Label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-input bg-surface px-3">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ta-amount"
                      type="number"
                      value={amount || ""}
                      placeholder={String(payload.suggestedMonthlyAmount || 0)}
                      onChange={(event) => setAmount(Number(event.target.value || 0))}
                      className="border-0 px-0 focus-visible:ring-0"
                    />
                    {kind !== "lump_sum" ? <span className="text-xs text-muted-foreground">/ month</span> : <span className="text-xs text-muted-foreground">one-time</span>}
                  </div>
                  {payload.suggestedMonthlyAmount ? (
                    <p className="mt-1 text-xs text-muted-foreground">Suggested: {inr(payload.suggestedMonthlyAmount)}{kind === "lump_sum" ? " one-time" : "/month"}</p>
                  ) : null}
                </div>
              ) : null}

              {fields.showStart || fields.showEnd ? (
                <div className="grid grid-cols-2 gap-3">
                  {fields.showStart ? (
                    <div>
                      <Label htmlFor="ta-start" className="text-sm font-medium text-foreground">{kind === "lump_sum" ? "Date" : "Start date"}</Label>
                      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-input bg-surface px-3">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <Input id="ta-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="border-0 px-0 focus-visible:ring-0" />
                      </div>
                    </div>
                  ) : null}
                  {fields.showEnd ? (
                    <div>
                      <Label htmlFor="ta-end" className="text-sm font-medium text-foreground">End date <span className="text-muted-foreground">(optional)</span></Label>
                      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-input bg-surface px-3">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <Input id="ta-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="border-0 px-0 focus-visible:ring-0" />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {linkGoal && fields.showAmount ? (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-surface-soft p-3">
                  <input
                    type="checkbox"
                    checked={linkToGoal}
                    onChange={(event) => setLinkToGoal(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="text-sm font-semibold text-foreground">Add to my {linkGoal.name} goal</span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">Counts this investment toward {linkGoal.name}. Untick to leave it unlinked — you can link it to another goal later from that goal&apos;s &ldquo;Manage links&rdquo;.</span>
                  </span>
                </label>
              ) : null}

              {kind === "habit" || kind === "debt" ? (
                <div className="rounded-xl bg-surface-soft p-3">
                  <p className="text-sm font-medium text-foreground">Commit to one or more</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Pick the steps you&apos;ll do this month.</p>
                  <ul className="mt-3 space-y-2">
                    {checklistFor(kind, payload).map((item) => (
                      <li key={item}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground/85">
                          <input
                            type="checkbox"
                            checked={commit.includes(item)}
                            onChange={() => toggleCommit(item)}
                            className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                          />
                          <span>{item}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {kind === "review" ? (
                <div className="rounded-xl border border-border bg-surface-soft p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">What this records</p>
                  <p className="mt-1">A review action with today&apos;s date — no money is moved. Add a note if you want a reminder of what you decided.</p>
                </div>
              ) : null}

              <div>
                <Label htmlFor="ta-notes" className="text-sm font-medium text-foreground">Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="ta-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={notePlaceholder(kind)} className="mt-1.5" />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={!canSubmit}>{existing ? "Save changes" : confirmLabel(kind)}</Button>
            </div>
            {existing ? (
              <button
                type="button"
                onClick={handleRemove}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-negative/30 bg-negative-soft/40 py-2 text-sm font-medium text-negative-foreground transition hover:bg-negative-soft"
              >
                <Trash2 className="h-4 w-4" /> Remove this action
              </button>
            ) : null}
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground"><Sparkles className="mt-0.5 h-3 w-3" />This records your intent inside FinCompanion. {fields.showAmount ? "To actually invest, use your broker or fund platform." : "Use the Coach for tailored help on this step."}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-soft p-3 text-center">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function fieldsFor(kind: ActionKind) {
  switch (kind) {
    case "fund":
      return { showAmount: true, showStart: true, showEnd: true, showInvestmentMeta: true };
    case "lump_sum":
      return { showAmount: true, showStart: true, showEnd: false, showInvestmentMeta: false };
    case "habit":
      return { showAmount: false, showStart: false, showEnd: false, showInvestmentMeta: false };
    case "debt":
      return { showAmount: false, showStart: false, showEnd: false, showInvestmentMeta: false };
    case "review":
    default:
      return { showAmount: false, showStart: true, showEnd: false, showInvestmentMeta: false };
  }
}

function checklistFor(kind: ActionKind, payload: TakeActionPayload): string[] {
  if (kind === "debt") {
    return [
      "No new loans or credit-card EMIs this month",
      "List every existing EMI and total monthly outflow",
      "Pay more than the minimum on the highest-interest debt",
      "Pause discretionary spending until ratio improves",
    ];
  }
  // habit
  const label = (payload.instrumentName + " " + payload.actionLabel).toLowerCase();
  if (label.includes("sip") || label.includes("stick") || label.includes("course")) {
    return [
      "Turn off daily portfolio notifications",
      "Continue existing SIPs even if markets fall",
      "Only review investments monthly, not daily",
      "Talk to the Coach before selling in a panic",
    ];
  }
  if (label.includes("savings") || label.includes("save")) {
    return [
      "Set up auto-debit on payday for the savings amount",
      "Trim one flexible expense (eating out / subscriptions)",
      "Move the saved money to a separate account",
      "Review again in 30 days",
    ];
  }
  return [
    "Add a calendar reminder for this action",
    "Track the change in next month's review",
  ];
}

function titleFor(kind: ActionKind, payload: TakeActionPayload) {
  const cat = payload.category || "";
  if (kind === "fund") return `${cat || "Investment"}${payload.ticker ? ` · ${payload.ticker}` : ""}`;
  if (kind === "lump_sum") return payload.goalName ? `One-time boost · ${payload.goalName}` : "One-time contribution";
  if (kind === "habit") return "Behavioral commitment";
  if (kind === "debt") return "Debt action";
  return "Review action";
}

function amountLabel(kind: ActionKind, past = false) {
  if (kind === "lump_sum") return past ? "Amount" : "One-time amount";
  return past ? "Amount" : "Monthly amount";
}

function notePlaceholder(kind: ActionKind) {
  if (kind === "fund") return "e.g. SIP date set for 5th, paused if income drops";
  if (kind === "lump_sum") return "e.g. Transferred from savings account on payday";
  if (kind === "habit") return "What you'll do differently this month";
  if (kind === "debt") return "e.g. Closed credit card EMI; will avoid new loans";
  return "Anything you want to remember";
}

function confirmLabel(kind: ActionKind) {
  if (kind === "fund") return "Start SIP";
  if (kind === "lump_sum") return "Record contribution";
  if (kind === "habit") return "Commit to this";
  if (kind === "debt") return "Commit to this";
  return "Record review";
}

function successHeadlineFor(kind: ActionKind) {
  if (kind === "fund") return "SIP recorded";
  if (kind === "lump_sum") return "Contribution recorded";
  if (kind === "habit") return "Commitment recorded";
  if (kind === "debt") return "Commitment recorded";
  return "Review noted";
}

function inferKind(payload: TakeActionPayload): ActionKind {
  const value = `${payload.instrumentName} ${payload.category} ${payload.actionLabel}`.toLowerCase();
  if (/avoid.*debt|reduce.*debt|repay|loan/.test(value)) return "debt";
  if (/catch[\s-]?up|boost|one[- ]?time|lump/.test(value)) return "lump_sum";
  if (/stick|stay.*course|don'?t.*panic|habit|review.*plan|rebalance/.test(value)) return "habit";
  if (/emergency.*fund|build.*emergency/.test(value)) return "fund"; // monthly transfer pattern
  if (/sip|fund|etf|stock|share|equity|gold|silver|crypto|bond|fd|bitcoin|ethereum|nifty|index|debt fund/.test(value)) return "fund";
  return "review";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
