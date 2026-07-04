"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

export default function PasswordResetPage() {
  return (
    <Suspense fallback={null}>
      <PasswordResetContent />
    </Suspense>
  );
}

function PasswordResetContent() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const email = params.get("email") || "";
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      {token && email ? <ChooseNewPassword token={token} email={email} /> : <RequestResetLink />}
    </main>
  );
}

function RequestResetLink() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit } = useForm<{ email: string }>();

  async function onSubmit(values: { email: string }) {
    setError("");
    setSubmitting(true);
    try {
      await api.passwordReset(values.email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? err.detail : "Could not send the link right now. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Reset password</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your email and we will send you a link to choose a new password.
        </p>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="rounded-md bg-primary/10 p-4 text-sm text-primary">
            If an account exists for that email, a reset link is on its way. It works for 30 minutes.
            Your saved details stay safe through the reset.
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" autoComplete="email" {...register("email", { required: true })} />
            </div>
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
        {error ? <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Remembered it? <Link className="text-primary" href="/login">Login</Link>
        </p>
      </CardContent>
    </Card>
  );
}

function ChooseNewPassword({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, watch } = useForm<{ password: string; confirm: string }>();

  async function onSubmit(values: { password: string; confirm: string }) {
    if (values.password !== values.confirm) {
      setError("The two passwords do not match.");
      return;
    }
    if (values.password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await api.passwordResetConfirm(email, token, values.password);
      setDone(true);
      setTimeout(() => router.replace("/login"), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not update the password. Request a new link and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Choose a new password</CardTitle>
        <p className="text-sm text-muted-foreground">For {email}. Your saved details stay safe through the reset.</p>
      </CardHeader>
      <CardContent>
        {done ? (
          <div className="rounded-md bg-primary/10 p-4 text-sm text-primary">
            Password updated. Taking you to login…
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>New password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                {...register("password", { required: true, minLength: 8 })}
              />
              {(watch("password") || "").length > 0 && (watch("password") || "").length < 8 ? (
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Repeat new password</Label>
              <Input type="password" autoComplete="new-password" {...register("confirm", { required: true })} />
            </div>
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
        {error ? <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Link expired? <Link className="text-primary" href="/password-reset">Request a new one</Link>
        </p>
      </CardContent>
    </Card>
  );
}
