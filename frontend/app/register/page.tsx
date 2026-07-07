"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type FormValues = { name: string; email: string; password: string; consent: boolean };

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useAuthStore((state) => state.register);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ defaultValues: { name: "", email: "", password: "", consent: false } });

  async function onSubmit(values: FormValues) {
    setError("");
    try {
      const result = await registerUser(values.name, values.email, values.password);
      if (!result.emailVerified) {
        router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
      } else {
        router.push("/onboarding");
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 0) setError("Backend unavailable. Start the API server and try again.");
        else if (error.status === 409) setError("This email is already registered. Try logging in instead.");
        else setError("Server error while creating the account. Please try again.");
      } else {
        setError("Server error while creating the account. Please try again.");
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <p className="text-sm text-muted-foreground">Start with a guided financial profile.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Enter your full name" {...register("name", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="you@example.com" {...register("email", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" placeholder="Create a password (8+ characters)" {...register("password", { required: true, minLength: 8 })} />
              {errors.password ? <p className="text-sm text-negative-foreground">Use at least 8 characters.</p> : null}
            </div>
            <label className="flex items-start gap-2.5 pt-1 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
                {...register("consent", { required: true })}
              />
              <span>
                I am 18 or older and I understand AskPapa gives educational guidance, not investment advice. I agree to the{" "}
                <Link className="font-semibold text-primary hover:underline" href="/terms" target="_blank">Terms</Link> and{" "}
                <Link className="font-semibold text-primary hover:underline" href="/privacy" target="_blank">Privacy Policy</Link>.
              </span>
            </label>
            {errors.consent ? <p className="text-sm text-negative-foreground">Please accept the Terms and Privacy Policy to continue.</p> : null}
            {error ? <p className="text-sm text-negative-foreground">{error}</p> : null}
            <Button className="w-full" type="submit">Get Started</Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account? <Link className="text-primary" href="/login">Login</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
