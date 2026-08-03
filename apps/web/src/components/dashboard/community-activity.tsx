"use client";

import * as React from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { NotificationSummary } from "@examora/types";
import { useNotificationsApi } from "@/lib/notifications-api";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { ListRowSkeleton } from "@/components/ui/skeleton";
import { IconBadge } from "@/components/ui/icon-badge";

// No "replies to my threads" / "mentor feedback" inbound feed exists in the
// Community or Mentoring modules — /community/activity/:userId is the
// student's own OUTBOUND activity (threads/replies they posted), the
// opposite of what this widget needs. Notifications already capture the
// exact inbound signal ("this happened, it's about you"), so this widget is
// the same notification feed as NotificationsWidget, filtered to the
// community/mentor event types.
const RELEVANT_EVENT_TYPES = new Set([
  "community.reply_received",
  "community.answer_accepted",
  "mentor.assigned",
  "assignment.review_published",
]);

type State =
  { status: "loading" } | { status: "error" } | { status: "ready"; data: NotificationSummary[] };

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function CommunityActivity() {
  const api = useNotificationsApi();
  const [state, setState] = React.useState<State>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    setState({ status: "loading" });
    api
      .listMine({ page: 1, pageSize: 25 })
      .then((res) =>
        setState({
          status: "ready",
          data: res.items.filter((n) => RELEVANT_EVENT_TYPES.has(n.eventType)).slice(0, 4),
        }),
      )
      .catch(() => setState({ status: "error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <section aria-labelledby="community-activity-heading">
      <div className="flex items-center justify-between">
        <h2
          id="community-activity-heading"
          className="font-heading text-lg font-semibold text-neutral-900"
        >
          Community
        </h2>
        <Link href="/community" className="text-xs font-medium text-primary-600 hover:underline">
          View all →
        </Link>
      </div>

      <div className="mt-3">
        {state.status === "loading" ? (
          <>
            <ListRowSkeleton />
            <ListRowSkeleton />
          </>
        ) : state.status === "error" ? (
          <RetryInline
            message="Couldn't load recent activity"
            onRetry={() => setAttempt((a) => a + 1)}
          />
        ) : state.data.length === 0 ? (
          <EmptyState
            heading="No activity yet"
            body="Ask your first question."
            actionLabel="Ask the community"
            actionHref="/community"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {state.data.map((n) => (
              <li key={n.id}>
                <Link
                  href="/community"
                  className="flex items-start gap-3 rounded-md py-2 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <IconBadge icon={MessageCircle} tone="accent" size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-neutral-800">{n.title}</span>
                    <span className="text-xs text-neutral-400">{timeAgo(n.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
