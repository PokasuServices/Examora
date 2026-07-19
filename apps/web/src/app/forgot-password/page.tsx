"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@examora/auth-client";
import { Button, Input, Label } from "@examora/ui";
import { AuthCard } from "@/components/auth-card";

export default function ForgotPasswordPage() {
  const { request } = useAuth();
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    try {
      // Always resolves — the API never confirms whether the email exists.
      await request("/auth/forgot-password", { method: "POST", body: { email } });
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <p className="text-sm text-neutral-600">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm text-primary-600 hover:underline">
          Back to login
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot your password?" description="We'll email you a link to reset it.">
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
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <Link href="/login" className="mt-6 inline-block text-sm text-primary-600 hover:underline">
        Back to login
      </Link>
    </AuthCard>
  );
}
