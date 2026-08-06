"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Megaphone, Users } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { useNotificationsApi } from "@/lib/notifications-api";

interface BroadcastCampaign {
  key: string;
  title: string;
  body: string;
  category: string;
  sentAt: string;
  recipientCount: number;
}

type Status = "loading" | "ready" | "error";

/**
 * Read-only reuse of the existing admin delivery-tracking endpoint
 * (GET /admin/notifications), filtered to platform.broadcast_announcement
 * and grouped client-side into campaigns — broadcast() fans out one
 * Notification row per targeted user, so there is no single "campaign"
 * record server-side; recipientCount here is a real count of the rows
 * returned, not an estimate. The composer and full per-channel delivery
 * dashboard already exist in apps/admin (/notifications/broadcast) —
 * rebuilding that here would duplicate business logic, so this stays
 * strictly a history view.
 */
function BroadcastHistoryContent() {
  const api = useNotificationsApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [campaigns, setCampaigns] = React.useState<BroadcastCampaign[]>([]);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listBroadcastHistory()
      .then((res) => {
        const groups = new Map<string, BroadcastCampaign>();
        for (const item of res.items) {
          const key = `${item.title}::${item.body}::${item.category}`;
          const existing = groups.get(key);
          if (existing) {
            existing.recipientCount += 1;
            if (item.createdAt < existing.sentAt) existing.sentAt = item.createdAt;
          } else {
            groups.set(key, {
              key,
              title: item.title,
              body: item.body,
              category: item.category,
              sentAt: item.createdAt,
              recipientCount: 1,
            });
          }
        }
        setCampaigns(Array.from(groups.values()).sort((a, b) => b.sentAt.localeCompare(a.sentAt)));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/notifications"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Notifications
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
          Broadcast history
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Platform-wide announcements sent to date. To send a new broadcast, use the composer in the
          admin console.
        </p>
      </div>

      {status === "loading" ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : status === "error" ? (
        <RetryInline message="Couldn't load broadcast history" onRetry={load} />
      ) : campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} heading="No broadcasts sent yet" />
      ) : (
        <div className="flex flex-col gap-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.key} density="compact">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-heading text-sm font-semibold text-neutral-900">
                  {campaign.title}
                </h2>
                <span className="shrink-0 text-xs text-neutral-400">
                  {new Date(campaign.sentAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">{campaign.body}</p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                <Users size={12} strokeWidth={1.75} aria-hidden="true" />
                {campaign.recipientCount} recipient{campaign.recipientCount === 1 ? "" : "s"}
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

export default function BroadcastHistoryPage() {
  return (
    <RequirePermission permission="notification:manage">
      <BroadcastHistoryContent />
    </RequirePermission>
  );
}
