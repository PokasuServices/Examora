import { AlertCircle, Clock, RotateCcw, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBadge } from "@/components/ui/icon-badge";
import type { ActivityEvent } from "./use-admin-dashboard";

const KIND_ICON = {
  order: ShoppingBag,
  refund: RotateCcw,
  report: AlertCircle,
} as const;

function timeAgo(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Real activity only — merged from actually-fetched recent orders, refund requests, and community reports. Never fabricated. */
export function RecentActivity({ events }: { events: ActivityEvent[] }) {
  return (
    <section aria-labelledby="recent-activity-heading">
      <div className="flex items-center gap-2">
        <Clock size={17} strokeWidth={1.75} className="text-neutral-500" aria-hidden="true" />
        <h2
          id="recent-activity-heading"
          className="font-heading text-lg font-semibold text-neutral-900"
        >
          Recent activity
        </h2>
      </div>
      <Card className="mt-4">
        {events.length === 0 ? (
          <EmptyState
            heading="Nothing recent"
            body="New orders, refunds, and reports will show up here."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {events.map((event) => {
              const Icon = KIND_ICON[event.kind];
              return (
                <li key={`${event.kind}-${event.id}`} className="flex items-start gap-3 py-3">
                  <IconBadge icon={Icon} tone="primary" size={24} />
                  <div className="min-w-0 flex-1">
                    <a
                      href={event.href}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium text-neutral-800 hover:text-primary-700 hover:underline"
                    >
                      {event.title}
                    </a>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{event.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-neutral-400">{timeAgo(event.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
