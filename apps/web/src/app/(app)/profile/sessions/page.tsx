"use client";

import { LogOut, Monitor } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconBadge } from "@/components/ui/icon-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RetryInline } from "@/components/ui/retry-inline";
import { EmptyState } from "@/components/ui/empty-state";
import { SettingsShell } from "@/components/settings/settings-shell";
import { useSessions } from "@/components/settings/use-sessions";
import { parseUserAgent } from "@/components/settings/format";
import type { SessionSummary } from "@/lib/settings-api";

function SessionRow({
  session,
  busy,
  onRevoke,
}: {
  session: SessionSummary;
  busy: boolean;
  onRevoke: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-neutral-100 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-800">{parseUserAgent(session.userAgent)}</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {session.ipAddress ?? "Unknown IP"} · started{" "}
          {new Date(session.createdAt).toLocaleString()}
        </p>
      </div>
      {session.isCurrent ? (
        <Chip tone="success">This device</Chip>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onRevoke}
          className="shrink-0 text-sm font-medium text-danger-600 hover:underline disabled:pointer-events-none disabled:opacity-60"
        >
          {busy ? "Revoking…" : "Revoke"}
        </button>
      )}
    </li>
  );
}

function SessionsContent() {
  const { status, current, others, busyId, revoke, revokeAll, retry } = useSessions();

  if (status === "loading") {
    return (
      <Card>
        <Skeleton className="h-5 w-32" />
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card>
        <RetryInline message="Couldn't load your sessions" onRetry={retry} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={Monitor} tone="primary" />
          <h2 className="font-heading text-lg font-semibold text-neutral-900">Current device</h2>
        </div>
        {current ? (
          <div className="mt-4">
            <SessionRow session={current} busy={false} onRevoke={() => undefined} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">
            We couldn&rsquo;t match this browser to one of your active sessions.
          </p>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-neutral-900">Other devices</h2>
          {others.length > 0 ? (
            <button
              type="button"
              disabled={busyId === "all"}
              onClick={() => void revokeAll()}
              className="flex items-center gap-1.5 text-sm font-medium text-danger-600 hover:underline disabled:pointer-events-none disabled:opacity-60"
            >
              <LogOut size={14} strokeWidth={2} aria-hidden="true" />
              {busyId === "all" ? "Logging out…" : "Log out other sessions"}
            </button>
          ) : null}
        </div>

        {others.length === 0 ? (
          <EmptyState
            icon={Monitor}
            heading="No other active sessions"
            body="You're only signed in on this device right now."
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {others.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                busy={busyId === session.id}
                onRevoke={() => void revoke(session.id)}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function SessionsPage() {
  return (
    <RequireAuth>
      <SettingsShell>
        <SessionsContent />
      </SettingsShell>
    </RequireAuth>
  );
}
