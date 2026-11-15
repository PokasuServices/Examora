"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, useAuth } from "@examora/auth-client";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { AuthLayout } from "@/components/layout/AuthLayout";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";

export default function LoginPage() {
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
    <AuthLayout title="Log in" description="Welcome back to Examora.">
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
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
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <div className="mt-6 flex items-center gap-3 text-xs uppercase text-neutral-400 dark:text-neutral-500">
        <span className="h-px flex-1 bg-neutral-200 dark:bg-white/10" />
        or
        <span className="h-px flex-1 bg-neutral-200 dark:bg-white/10" />
      </div>

      <a
        href={`${API_ORIGIN}/api/v1/auth/google`}
        className="mt-6 flex h-10 w-full items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-700 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-white/[0.03]"
      >
        Continue with Google
      </a>

      <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-primary-600 dark:text-primary-400 hover:underline">
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}
