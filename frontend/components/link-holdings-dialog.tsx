"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InvestmentLogo } from "@/components/investment-logo";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { inr } from "@/lib/utils";
import { OnboardingProfile, PortfolioHolding, ProfileGoal } from "@/types";

type Mode = { index: number; goal: ProfileGoal };

export function LinkHoldingsDialog({
  mode,
  holdings,
  trigger,
}: {
  mode: Mode;
  holdings: PortfolioHolding[];
  trigger: React.ReactNode;
}) {
  const profile = useAuthStore((state) => state.profile);
  const token = useAuthStore((state) => state.token);
  const saveProfile = useAuthStore((state) => state.saveProfile);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(mode.goal.linkedHoldingIds || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(mode.goal.linkedHoldingIds || []);
      setError(null);
    }
  }, [open, mode]);

  const linkedValue = useMemo(
    () => holdings.filter((h) => selected.includes(h.id)).reduce((sum, h) => sum + h.value, 0),
    [holdings, selected],
  );
  const monthlyTracked = useMemo(
    () => holdings.filter((h) => selected.includes(h.id) && h.source === "action").reduce((sum, h) => sum + (h.monthlyContribution || 0), 0),
    [holdings, selected],
  );

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  async function handleSave() {
    if (!profile) {
      setError("No profile loaded.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const goals = [...(profile.goals || [])];
      goals[mode.index] = { ...goals[mode.index], linkedHoldingIds: selected };
      const next: OnboardingProfile = { ...profile, goals };
      await api.saveOnboarding(next, token, { partial: true });
      saveProfile(next, true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save linked holdings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[min(600px,94vw)] overflow-y-auto p-0">
        <div className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Link2 className="h-4 w-4" /> Link holdings to {displayName(mode.goal)}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-muted-foreground">
            Pick the holdings already saved against this goal. Their current value (and SIPs that are still running) will track automatically.
          </DialogDescription>
        </div>

        <div className="space-y-3 p-6">
          {holdings.length ? (
            holdings.map((holding) => {
              const checked = selected.includes(holding.id);
              const fromAction = holding.source === "action";
              return (
                <label
                  key={holding.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${checked ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-surface-hover"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(holding.id)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <InvestmentLogo name={holding.name} category={holding.category} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">{holding.name}</p>
                      {fromAction ? <Badge tone="primary" className="text-[10px]">From plan</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {holding.category}
                      {fromAction && holding.monthlyContribution ? ` · ${inr(holding.monthlyContribution)}/mo SIP` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-foreground">{inr(holding.value)}</p>
                </label>
              );
            })
          ) : (
            <div className="rounded-xl bg-surface-soft p-6 text-center text-sm text-muted-foreground">
              <p>No holdings to link yet.</p>
              <p className="mt-1">Add investments to your profile or take action on a plan recommendation to see them here.</p>
            </div>
          )}

          {selected.length ? (
            <div className="rounded-xl bg-positive-soft/50 p-3 text-sm text-foreground">
              <p className="flex items-center gap-1.5 font-semibold"><Sparkles className="h-3.5 w-3.5" /> Linked total: {inr(linkedValue)}</p>
              {monthlyTracked > 0 ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{inr(monthlyTracked)}/month from active SIPs will keep adding to this.</p>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="rounded-lg bg-negative-soft p-3 text-sm text-negative-foreground">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save links"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function displayName(goal: ProfileGoal) {
  return goal.type === "Other" ? goal.customName || "this goal" : goal.type || "this goal";
}
