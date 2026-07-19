"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, useAuth } from "@examora/auth-client";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { AuthCard } from "@/components/auth-card";

function ResetPasswordForm() {
  const router = useRouter();
  const { request } = useAuth();
  const token = useSearchParams().get("token") ?? "";
  const [newPassword, setNewPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await request("/auth/reset-password", { method: "POST", body: { token, newPassword } });
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Invalid link">
        <p className="text-sm text-neutral-600">
          This password reset link is missing its token. Request a new one below.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block text-sm text-primary-600 hover:underline"
        >
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Resetting…" : "Reset password"}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetPasswordForm />
    </React.Suspense>
  );
}
