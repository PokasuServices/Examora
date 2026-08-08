"use client";

import * as React from "react";
import Link from "next/link";
import { ApiError } from "@examora/auth-client";
import { CheckCircle2, KeyRound, Mail, Monitor, ShieldCheck } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconBadge } from "@/components/ui/icon-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RetryInline } from "@/components/ui/retry-inline";
import { AutosaveIndicator, type AutosaveStatus } from "@/components/ui/autosave-indicator";
import { SettingsShell } from "@/components/settings/settings-shell";
import { useSettingsApi, type SessionSummary } from "@/lib/settings-api";
import { useSessions } from "@/components/settings/use-sessions";
import { parseUserAgent } from "@/components/settings/format";
import { useProfile } from "@/components/settings/use-profile";

function SecurityStatusCard({
  emailVerified,
  sessionCount,
}: {
  emailVerified: boolean;
  sessionCount: number;
}) {
  const checks = [
    {
      label: "Email verified",
      pass: emailVerified,
      hint: emailVerified
        ? "Your email is confirmed."
        : "Verify your email to secure your account.",
    },
  ];
  const passed = checks.filter((c) => c.pass).length;

  return (
    <Card>
      <div className="flex items-center gap-2">
        <IconBadge icon={ShieldCheck} tone="primary" />
        <h2 className="font-heading text-lg font-semibold text-neutral-900">
          Account security status
        </h2>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        {passed} of {checks.length} security essentials in place.
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-neutral-100">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-3 py-2.5">
            <CheckCircle2
              size={18}
              strokeWidth={1.75}
              className={check.pass ? "text-success-600" : "text-neutral-300"}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-neutral-800">{check.label}</p>
              <p className="text-xs text-neutral-500">{check.hint}</p>
            </div>
          </li>
        ))}
        <li className="flex items-center gap-3 py-2.5">
          <Monitor size={18} strokeWidth={1.75} className="text-neutral-400" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-neutral-800">
              {sessionCount} active {sessionCount === 1 ? "session" : "sessions"}
            </p>
            <p className="text-xs text-neutral-500">
              <Link href="/profile/sessions" className="text-primary-600 hover:underline">
                Review your sessions
              </Link>
            </p>
          </div>
        </li>
      </ul>
    </Card>
  );
}

function PasswordCard({ email }: { email: string }) {
  const api = useSettingsApi();
  const [status, setStatus] = React.useState<AutosaveStatus>("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function sendReset(): Promise<void> {
    setStatus("saving");
    setError(null);
    try {
      await api.requestPasswordReset(email);
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Could not send the reset email.");
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <IconBadge icon={KeyRound} tone="primary" />
        <h2 className="font-heading text-lg font-semibold text-neutral-900">Password</h2>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        We&rsquo;ll email a reset link to{" "}
        <span className="font-medium text-neutral-700">{email}</span> — there&rsquo;s no in-app form
        for changing your password directly.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void sendReset()}
          disabled={status === "saving"}
          className="flex h-10 items-center rounded-md border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
        >
          {status === "saving" ? "Sending…" : "Send password reset email"}
        </button>
        <AutosaveIndicator status={status} errorLabel={error ?? "Couldn't send — try again"} />
      </div>
    </Card>
  );
}

function EmailVerificationCard({ email, verified }: { email: string; verified: boolean }) {
  const api = useSettingsApi();
  const [status, setStatus] = React.useState<AutosaveStatus>("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function resend(): Promise<void> {
    setStatus("saving");
    setError(null);
    try {
      await api.resendVerification(email);
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Could not resend the email.");
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconBadge icon={Mail} tone={verified ? "success" : "warning"} />
          <h2 className="font-heading text-lg font-semibold text-neutral-900">
            Email verification
          </h2>
        </div>
        <Chip tone={verified ? "success" : "warning"}>
          {verified ? "Verified" : "Not verified"}
        </Chip>
      </div>
      {!verified ? (
        <>
          <p className="mt-2 text-sm text-neutral-500">
            Verify <span className="font-medium text-neutral-700">{email}</span> to unlock full
            account security.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void resend()}
              disabled={status === "saving"}
              className="flex h-10 items-center rounded-md border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
            >
              {status === "saving" ? "Sending…" : "Resend verification email"}
            </button>
            <AutosaveIndicator status={status} errorLabel={error ?? "Couldn't send — try again"} />
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">Your email address is confirmed.</p>
      )}
    </Card>
  );
}

function SessionsSummaryCard({
  status,
  current,
  otherCount,
  onRetry,
}: {
  status: "loading" | "ready" | "error";
  current: SessionSummary | null;
  otherCount: number;
  onRetry: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconBadge icon={Monitor} tone="primary" />
          <h2 className="font-heading text-lg font-semibold text-neutral-900">Active sessions</h2>
        </div>
        <Link
          href="/profile/sessions"
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          Manage all →
        </Link>
      </div>

      {status === "loading" ? (
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : status === "error" ? (
        <div className="mt-2">
          <RetryInline message="Couldn't load your sessions" onRetry={onRetry} />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2 text-sm">
          {current ? (
            <div className="flex items-center justify-between rounded-md border border-neutral-100 p-3">
              <div>
                <p className="font-medium text-neutral-800">{parseUserAgent(current.userAgent)}</p>
                <p className="text-xs text-neutral-500">This device</p>
              </div>
              <Chip tone="success">Current</Chip>
            </div>
          ) : null}
          <p className="text-xs text-neutral-500">
            {otherCount} other {otherCount === 1 ? "session" : "sessions"} signed in.
          </p>
        </div>
      )}
    </Card>
  );
}

function SecurityContent() {
  const { status: profileStatus, profile, retry: retryProfile } = useProfile();
  const { status: sessionsStatus, sessions, current, others, retry: retrySessions } = useSessions();

  if (profileStatus === "loading") {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-4 h-16 w-full" />
        </Card>
      </div>
    );
  }

  if (profileStatus === "error" || !profile) {
    return <RetryInline message="Couldn't load your security settings" onRetry={retryProfile} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <SecurityStatusCard emailVerified={profile.emailVerified} sessionCount={sessions.length} />
      <PasswordCard email={profile.email} />
      <EmailVerificationCard email={profile.email} verified={profile.emailVerified} />
      <SessionsSummaryCard
        status={sessionsStatus}
        current={current}
        otherCount={others.length}
        onRetry={retrySessions}
      />
    </div>
  );
}

export default function SecurityPage() {
  return (
    <RequireAuth>
      <SettingsShell>
        <SecurityContent />
      </SettingsShell>
    </RequireAuth>
  );
}
