"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, useAuth } from "@examora/auth-client";
import { CURRENT_TERMS_VERSION } from "@examora/shared";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { AuthCard } from "@/components/auth-card";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!acceptTerms) {
      setError("You must accept the Terms of Service to register.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        consentVersion: CURRENT_TERMS_VERSION,
        acceptTerms,
      });
      router.push("/verify-email?pending=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Create your account" description="Start preparing for your entrance exam.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
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
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
          />
          I agree to the Terms of Service and Privacy Policy ({CURRENT_TERMS_VERSION})
        </label>
        <FieldError>{error}</FieldError>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-600">
        Already have an account?{" "}
        <Link href="/login" className="text-primary-600 hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
