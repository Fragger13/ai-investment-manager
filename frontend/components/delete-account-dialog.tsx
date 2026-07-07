"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

/** Permanent account + data deletion, guarded by password re-entry and a typed
 *  confirmation. On success the session is cleared and the user is sent home. */
export function DeleteAccountDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const canDelete = password.length > 0 && confirmText.trim().toUpperCase() === "DELETE";

  async function handleDelete() {
    if (!canDelete) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteAccount(password);
      logout();
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError("Wrong password. Please try again.");
      else setError("Could not delete the account. Please try again in a moment.");
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) { setPassword(""); setConfirmText(""); setError(""); setBusy(false); }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[min(440px,94vw)]">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-negative-soft">
          <AlertTriangle className="h-5 w-5 text-negative-foreground" />
        </div>
        <DialogTitle className="mt-3 text-center text-lg font-bold text-foreground">Delete your account?</DialogTitle>
        <DialogDescription className="mt-1 text-center text-sm text-muted-foreground">
          This permanently erases your account and every bit of your financial data. It cannot be undone.
        </DialogDescription>

        <div className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label>Your password</Label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Confirm it is you"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type DELETE to confirm</Label>
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="DELETE"
            />
          </div>
          {error ? <p className="text-sm font-medium text-negative-foreground">{error}</p> : null}
        </div>

        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Keep my account</Button>
          <Button
            className="flex-1 bg-negative-foreground text-white hover:bg-negative-foreground/90"
            disabled={!canDelete || busy}
            onClick={handleDelete}
          >
            {busy ? "Deleting…" : "Delete forever"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
