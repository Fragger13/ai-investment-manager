"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type FormValues = { email: string; password: string };

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm<FormValues>({ defaultValues: { email: "", password: "" } });

  async function onSubmit(values: FormValues) {
    setError("");
    setLoading(true);
    try {
      const result = await login(values.email, values.password);
      if (!result.emailVerified) {
        router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
      } else if (result.onboardingComplete) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 0) setError("Can't reach the server right now. Try again in a moment.");
        else if (error.status === 404) setError("No account found for this email. Want to create one below?");
        else if (error.status === 401) setError("That password doesn't match. Try again or reset it.");
        else if (error.status === 409) setError(error.detail);
        else setError("Something went wrong logging in. Please try again.");
      } else {
        setError("Something went wrong logging in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-grape/15 blur-3xl" />

      <Card className="relative w-full max-w-md card-pop">
        <CardContent className="p-7 sm:p-8">
          <div className="flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/papa-avatar.png" alt="AskPapa" className="h-16 w-16 rounded-full object-cover shadow-sm ring-4 ring-accent" />
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Welcome back! 👋</h1>
            <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">Let&apos;s pick up where you left off.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="you@example.com" autoComplete="email" {...register("email", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" placeholder="Your password" autoComplete="current-password" {...register("password", { required: true })} />
            </div>
            {error ? (
              <p className="rounded-xl bg-negative-soft px-3.5 py-2.5 text-sm font-medium text-negative-foreground">{error}</p>
            ) : null}
            <Button size="lg" className="w-full" type="submit" disabled={loading}>
              {loading ? "Logging in…" : "Log in →"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm">
            <Link className="font-semibold text-primary hover:underline" href="/password-reset">Forgot password?</Link>
          </p>

          <div className="mt-6 rounded-2xl bg-surface-soft p-4 text-center">
            <p className="text-sm text-muted-foreground">New to AskPapa?</p>
            <Link className="mt-1 inline-block font-bold text-primary hover:underline" href="/register">Create your free account →</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
