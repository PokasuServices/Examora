"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, useAuth } from "@examora/auth-client";
import { Button, Input, Label } from "@examora/ui";
import { AuthCard } from "@/components/auth-card";

type VerifyState = "idle" | "verifying" | "verified" | "error";

function VerifyEmailContent() {
  const { request, refetchUser, user } = useAuth();
  const params = useSearchParams();
  const token = params.get("token");
  const pending = params.get("pending") === "1";

  const [state, setState] = React.useState<VerifyState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [resendEmail, setResendEmail] = React.useState(user?.email ?? "");
  const [resendSent, setResendSent] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    setState("verifying");
    request("/auth/verify-email", { method: "POST", body: { token } })
      .then(async () => {
        setState("verified");
        await refetchUser();
      })
      .catch((err: unknown) => {
        setState("error");
        setError(err instanceof ApiError ? err.message : "Verification failed.");
      });
    // Only re-run if the token itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function resend(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    await request("/auth/resend-verification", { method: "POST", body: { email: resendEmail } });
    setResendSent(true);
  }

  if (state === "verified") {
    return (
      <AuthCard title="Email verified">
        <p className="text-sm text-neutral-600">Your account is now active.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-primary-600 hover:underline">
          Continue
        </Link>
      </AuthCard>
    );
  }

  if (state === "verifying") {
    return (
      <AuthCard title="Verifying…">
        <p className="text-sm text-neutral-600">Confirming your email address.</p>
      </AuthCard>
    );
  }

  if (state === "error") {
    return (
      <AuthCard title="Verification failed">
        <p className="text-sm text-error-600">{error}</p>
        <p className="mt-4 text-sm text-neutral-600">
          The link may have expired. Request a new one below.
        </p>
        <ResendForm
          email={resendEmail}
          setEmail={setResendEmail}
          onSubmit={resend}
          sent={resendSent}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={pending ? "Check your email" : "Verify your email"}
      description="Click the link we emailed you to activate your account."
    >
      <ResendForm
        email={resendEmail}
        setEmail={setResendEmail}
        onSubmit={resend}
        sent={resendSent}
      />
    </AuthCard>
  );
}

function ResendForm({
  email,
  setEmail,
  onSubmit,
  sent,
}: {
  email: string;
  setEmail: (value: string) => void;
  onSubmit: (event: React.FormEvent) => Promise<void>;
  sent: boolean;
}) {
  if (sent) {
    return (
      <p className="mt-4 text-sm text-neutral-600">
        If that account needs verifying, a new link is on its way.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3" noValidate>
      <Label htmlFor="resendEmail">Resend verification email</Label>
      <div className="flex gap-2">
        <Input
          id="resendEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" variant="secondary">
          Resend
        </Button>
      </div>
    </form>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyEmailContent />
    </React.Suspense>
  );
}
