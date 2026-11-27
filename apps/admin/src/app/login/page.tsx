"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ApiError, useAuth } from "@examora/auth-client";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { AuthLayout } from "@/components/layout/AuthLayout";

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Admin sign in" description="Staff access only.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
        Forgot your password?{" "}
        <a
          href={`${WEB_ORIGIN}/forgot-password`}
          className="text-primary-600 dark:text-primary-400 hover:underline"
        >
          Reset it on the student site
        </a>
      </p>
    </AuthLayout>
  );
}
