import { History } from "lucide-react";
import type { AuditLogEntry } from "@examora/types";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";

function formatAction(action: string): string {
  return action
    .split(".")
    .pop()!
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function describeChange(entry: AuditLogEntry): string | null {
  const before = entry.beforeState as Record<string, unknown> | null;
  const after = entry.afterState as Record<string, unknown> | null;
  if (!after) return null;
  const parts: string[] = [];
  for (const key of Object.keys(after)) {
    const beforeVal = before?.[key];
    const afterVal = after[key];
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      parts.push(`${key}: ${JSON.stringify(beforeVal) ?? "—"} → ${JSON.stringify(afterVal)}`);
    }
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

export function UserAuditPanel({
  status,
  entries,
  total,
  fetchSize,
  onRetry,
}: {
  status: "loading" | "ready" | "not-found" | "error";
  entries: AuditLogEntry[];
  /** Total User-entity audit entries platform-wide (not just this user) — used only to detect truncation. */
  total: number;
  fetchSize: number;
  onRetry: () => void;
}) {
  if (status === "loading") {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (status === "error") {
    return <RetryInline message="Couldn't load account activity" onRetry={onRetry} />;
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        heading="No recorded activity"
        body="Role and status changes for this account will appear here."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-100">
      {entries.map((entry) => {
        const change = describeChange(entry);
        return (
          <li key={entry.id} className="py-3">
            <p className="text-sm font-medium text-neutral-800">{formatAction(entry.action)}</p>
            {change ? <p className="mt-0.5 text-xs text-neutral-500">{change}</p> : null}
            <p className="mt-0.5 text-xs text-neutral-400">
              {new Date(entry.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </li>
        );
      })}
      {total > fetchSize ? (
        <li className="pt-3 text-xs text-neutral-400">
          Only the {fetchSize} most recent account-related audit entries platform-wide were checked
          — older activity for this account may not be shown.
        </li>
      ) : null}
    </ul>
  );
}
