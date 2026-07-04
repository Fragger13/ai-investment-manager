"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Compass, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useTourStore } from "@/store/tour-store";

const CATEGORIES = [
  "Bug / something broke",
  "Feature request",
  "Question about my plan",
  "General feedback",
  "Account / login issue",
  "Other",
];

export default function HelpPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const startTour = useTourStore((state) => state.start);
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    if (!category) { setError("Pick a topic so we can route it to the right place."); return; }
    if (message.trim().length < 3) { setError("Add a short message about what's going on."); return; }
    setError("");
    setSending(true);
    try {
      await api.submitFeedback({ kind: "contact", category, message: message.trim(), email: email.trim(), page: "/help" });
      setSent(true);
    } catch {
      setError("Couldn't send right now. Please try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-7">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">Help &amp; Contact 🛟</h1>
        <p className="mt-2 text-base text-muted-foreground">Got a question, hit a bug, or have an idea? Tell Papa — it goes straight to him.</p>
      </div>

      <Card className="max-w-4xl">
        <CardContent className="p-6">
          {sent ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-positive-foreground" />
              <p className="mt-3 text-lg font-bold text-foreground">Message sent — thank you!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ve got it{email ? <> and will reply at <span className="font-semibold text-foreground">{email}</span> if needed</> : ""}.
              </p>
              <Button className="mt-5" variant="outline" onClick={() => { setSent(false); setCategory(""); setMessage(""); }}>
                Send another
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-foreground">What&apos;s this about?</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Choose a topic" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="help-message" className="text-sm font-medium text-foreground">Your message</Label>
                <Textarea
                  id="help-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Tell us what's on your mind…"
                  className="mt-1.5 min-h-[240px]"
                />
              </div>

              <div>
                <Label htmlFor="help-email" className="text-sm font-medium text-foreground">
                  Your email <span className="font-normal text-muted-foreground">(optional, so we can reply)</span>
                </Label>
                <Input
                  id="help-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5"
                />
              </div>

              {error ? <p className="text-sm text-negative-foreground">{error}</p> : null}

              <Button onClick={send} disabled={sending} className="w-full sm:w-auto">
                {sending ? "Sending…" : <>Send <Send className="h-4 w-4" /></>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-5 max-w-4xl border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Compass className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-foreground">New here, or need a refresher?</p>
              <p className="mt-1 text-sm text-muted-foreground">Let Papa walk you through the app again — the Plan, taking actions, and where everything lives.</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => { startTour(); router.push("/dashboard"); }}
          >
            Take the app tour again
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
