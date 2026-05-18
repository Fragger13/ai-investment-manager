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

type FormValues = { email: string; password: string };

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [error, setError] = useState("");
  const { register, handleSubmit } = useForm<FormValues>({ defaultValues: { email: "", password: "" } });

  async function onSubmit(values: FormValues) {
    setError("");
    try {
      await login(values.email, values.password);
      router.push("/onboarding");
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 0) setError("Backend unavailable. Start the API server and try again.");
        else if (error.status === 404) setError("No account was found for this email. Check the email or create a new account.");
        else if (error.status === 401) setError("Wrong password. Try again or use password reset.");
        else if (error.status === 409) setError(error.detail);
        else setError("Server error while logging in. Please try again.");
      } else {
        setError("Server error while logging in. Please try again.");
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <p className="text-sm text-muted-foreground">Enter your account details to continue.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="you@example.com" {...register("email", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" placeholder="Enter your password" {...register("password", { required: true })} />
            </div>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <Button className="w-full" type="submit">Login</Button>
          </form>
          <p className="mt-4 text-center text-sm">
            <Link className="text-primary" href="/password-reset">Forgot password?</Link>
          </p>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            New here? <Link className="text-primary" href="/register">Create account</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
