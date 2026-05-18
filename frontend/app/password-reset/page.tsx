"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

type FormValues = { email: string };

export default function PasswordResetPage() {
  const [status, setStatus] = useState("");
  const { register, handleSubmit } = useForm<FormValues>({ defaultValues: { email: "investor@example.com" } });

  async function onSubmit(values: FormValues) {
    const response = await api.passwordReset(values.email);
    setStatus(response.status);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <p className="text-sm text-muted-foreground">Prototype flow for a secure reset link.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...register("email", { required: true })} />
            </div>
            <Button className="w-full" type="submit">Send reset link</Button>
          </form>
          {status ? <p className="mt-4 rounded-md bg-primary/10 p-3 text-sm text-primary">{status}</p> : null}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Remembered it? <Link className="text-primary" href="/login">Login</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
