"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

const KEY = "askpapa-feedback-prompt";
const SESSION_FLAG = "askpapa-feedback-shown";
const SNOOZE_DAYS = 3;
const DELAY_MS = 25_000; // surface ~25s into a session, never immediately

type Persisted = { submittedAt?: string; snoozedUntil?: number };

function readState(): Persisted {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function writeState(next: Persisted) {
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

/** Occasional, dismissible star-rating prompt. Shown at most once per browser
 *  session, never again after a rating is given, and snoozed a few days on
 *  dismiss — so it nudges "now and then" without nagging. */
export function FeedbackPrompt() {
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SESSION_FLAG)) return;
    const s = readState();
    if (s.submittedAt) return;                                   // already rated
    if (s.snoozedUntil && Date.now() < s.snoozedUntil) return;   // snoozed recently
    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem(SESSION_FLAG, "1");
      setOpen(true);
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  function snooze() {
    writeState({ ...readState(), snoozedUntil: Date.now() + SNOOZE_DAYS * 86_400_000 });
    setOpen(false);
  }

  async function submit() {
    if (rating < 1) return;
    setSending(true);
    try {
      await api.submitFeedback({ kind: "rating", rating, message: message.trim(), email: user?.email || "", page: pathname || "" });
    } catch { /* feedback is best-effort; don't block the thank-you */ }
    writeState({ submittedAt: new Date().toISOString() });
    setSending(false);
    setDone(true);
    window.setTimeout(() => setOpen(false), 1600);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) snooze(); }}>
      <DialogContent className="w-[min(420px,94vw)] p-0">
        {done ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-positive-soft text-2xl">🙏</div>
            <p className="mt-3 text-lg font-bold text-foreground">Thank you, beta!</p>
            <p className="mt-1 text-sm text-muted-foreground">Your feedback helps Papa get better.</p>
          </div>
        ) : (
          <div className="p-6">
            <DialogTitle className="text-lg font-semibold text-foreground">How&apos;s AskPapa working for you?</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">Tap to rate — it takes a second and really helps.</DialogDescription>
            <div className="mt-4 flex justify-center gap-1.5" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  className="rounded-full p-1 transition hover:scale-110"
                >
                  <Star className={cn("h-9 w-9 transition", (hover || rating) >= n ? "fill-sun text-sun" : "fill-transparent text-border")} />
                </button>
              ))}
            </div>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Anything we can improve? (optional)"
              className="mt-4 min-h-[72px]"
            />
            <div className="mt-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={snooze}>Maybe later</Button>
              <Button className="flex-1" onClick={submit} disabled={rating < 1 || sending}>{sending ? "Sending…" : "Send feedback"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
