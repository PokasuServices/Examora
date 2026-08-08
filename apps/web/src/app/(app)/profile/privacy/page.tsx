"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import { CURRENT_TERMS_VERSION } from "@examora/shared";
import { FileCheck2, Mail } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconBadge } from "@/components/ui/icon-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RetryInline } from "@/components/ui/retry-inline";
import { AutosaveIndicator, type AutosaveStatus } from "@/components/ui/autosave-indicator";
import { SettingsShell } from "@/components/settings/settings-shell";
import { useSettingsApi } from "@/lib/settings-api";
import { useProfile } from "@/components/settings/use-profile";

function ConsentRecordCard({
  consentVersion,
  consentedAt,
}: {
  consentVersion: string | null;
  consentedAt: string | null;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <IconBadge icon={FileCheck2} tone="primary" />
        <h2 className="font-heading text-lg font-semibold text-neutral-900">
          Consent &amp; policy acknowledgement
        </h2>
      </div>
      {consentVersion && consentedAt ? (
        <div className="mt-4 flex items-center justify-between rounded-md border border-neutral-100 p-3 text-sm">
          <div>
            <p className="font-medium text-neutral-800">Terms of Service {consentVersion}</p>
            <p className="text-xs text-neutral-500">
              Accepted{" "}
              {new Date(consentedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <Chip tone="success">Accepted</Chip>
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">No consent record on file yet.</p>
      )}
      <p className="mt-3 text-xs text-neutral-500">
        This is the one consent record Examora keeps for your account — a full history of every past
        decision isn&rsquo;t available.
      </p>
    </Card>
  );
}

function MarketingPreferencesCard() {
  const api = useSettingsApi();
  const [status, setStatus] = React.useState<AutosaveStatus>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [lastChoice, setLastChoice] = React.useState<"in" | "out" | null>(null);

  async function choose(granted: boolean): Promise<void> {
    setStatus("saving");
    setError(null);
    try {
      await api.recordConsent({
        type: "MARKETING",
        version: CURRENT_TERMS_VERSION,
        channel: "web",
        granted,
      });
      setLastChoice(granted ? "in" : "out");
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Could not save your preference.");
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <IconBadge icon={Mail} tone="primary" />
        <h2 className="font-heading text-lg font-semibold text-neutral-900">
          Marketing preferences
        </h2>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        Choose whether Examora can send you product updates and marketing emails. Consent is
        write-only on the backend, so we can&rsquo;t display your current choice here — only record
        a new one.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void choose(true)}
          disabled={status === "saving"}
          className="flex h-10 items-center rounded-md border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
        >
          Opt in
        </button>
        <button
          type="button"
          onClick={() => void choose(false)}
          disabled={status === "saving"}
          className="flex h-10 items-center rounded-md border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
        >
          Opt out
        </button>
        <AutosaveIndicator status={status} errorLabel={error ?? "Couldn't save — try again"} />
      </div>
      {status === "saved" && lastChoice ? (
        <p className="mt-2 text-sm text-success-700">
          You&rsquo;ve {lastChoice === "in" ? "opted in to" : "opted out of"} marketing emails.
        </p>
      ) : null}
    </Card>
  );
}

function PrivacyContent() {
  const { status, profile, retry } = useProfile();

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="mt-4 h-14 w-full" />
        </Card>
      </div>
    );
  }

  if (status === "error" || !profile) {
    return <RetryInline message="Couldn't load your privacy settings" onRetry={retry} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ConsentRecordCard
        consentVersion={profile.consentVersion}
        consentedAt={profile.consentedAt}
      />
      <MarketingPreferencesCard />
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <RequireAuth>
      <SettingsShell>
        <PrivacyContent />
      </SettingsShell>
    </RequireAuth>
  );
}
