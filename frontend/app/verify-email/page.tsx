"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center" />}>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const storeEmail = useAuthStore((state) => state.user?.email);
  const verifyEmail = useAuthStore((state) => state.verifyEmail);
  const email = (params.get("email") || storeEmail || "").toLowerCase();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendingAt, setResendingAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown for resend cooldown
  useEffect(() => {
    if (!resendingAt) return;
    const tick = () => {
      const diff = Math.max(0, RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - resendingAt) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) setResendingAt(null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [resendingAt]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const submit = useCallback(
    async (entered: string) => {
      if (entered.length !== CODE_LENGTH) return;
      setSubmitting(true);
      setError("");
      setInfo("");
      try {
        await verifyEmail(email, entered);
        router.push("/onboarding");
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.detail || "That code didn't work. Try again.");
        } else {
          setError("Something went wrong. Try again.");
        }
        setSubmitting(false);
      }
    },
    [email, router, verifyEmail]
  );

  function handleChange(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = clean;
    setCode(next);
    if (clean && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
    if (next.every((d) => d !== "")) {
      submit(next.join(""));
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!text) return;
    event.preventDefault();
    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < text.length; i += 1) next[i] = text[i];
    setCode(next);
    if (text.length === CODE_LENGTH) {
      submit(text);
    } else {
      inputs.current[Math.min(text.length, CODE_LENGTH - 1)]?.focus();
    }
  }

  async function handleResend() {
    if (resendingAt && secondsLeft > 0) return;
    setError("");
    setInfo("");
    try {
      const response = await api.resendVerification(email);
      if (response.sent) {
        setInfo(`New code sent to ${email}.`);
        setResendingAt(Date.now());
      } else if (response.email_verified) {
        setInfo("Already verified. Redirecting…");
        router.push("/onboarding");
      } else {
        setError(response.detail || "Couldn't send a new code. Try again in a minute.");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Couldn't send a new code right now.");
      } else {
        setError("Couldn't send a new code right now.");
      }
    }
  }

  if (!email) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Verify your email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              We don&apos;t know which email to verify. <Link className="text-primary" href="/register">Sign up</Link> or
              <Link className="ml-1 text-primary" href="/login">log in</Link> to continue.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. Enter it below to continue.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputs.current[index] = el;
                  }}
                  value={digit}
                  onChange={(event) => handleChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  disabled={submitting}
                  aria-label={`Digit ${index + 1}`}
                  className="h-14 w-12 rounded-xl border border-border bg-surface text-center text-2xl font-semibold text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                />
              ))}
            </div>

            {error ? <p className="text-sm text-negative-foreground">{error}</p> : null}
            {info ? (
              <p className="flex items-center gap-1.5 text-sm text-positive-foreground">
                <CheckCircle2 className="h-4 w-4" /> {info}
              </p>
            ) : null}

            <Button
              className="w-full"
              disabled={submitting || code.some((d) => d === "")}
              onClick={() => submit(code.join(""))}
            >
              {submitting ? "Verifying…" : "Verify and continue"}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Didn&apos;t get it?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendingAt !== null && secondsLeft > 0}
                className="inline-flex items-center gap-1.5 font-medium text-primary transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {resendingAt && secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Wrong email?
              <Link href="/register" className="ml-1 text-primary">Sign up again</Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
