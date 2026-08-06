import type { NotificationSummary } from "@examora/types";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { timeAgo } from "@/lib/format";
import { categoryMeta } from "./types";

export function NotificationCard({
  notification,
  onOpen,
}: {
  notification: NotificationSummary;
  onOpen: (notification: NotificationSummary) => void;
}) {
  const meta = categoryMeta(notification.category);
  const Icon = meta.icon;

  return (
    <Card interactive density="compact" className="!p-0">
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="flex w-full items-start gap-3 rounded-card p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-600"
        >
          <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`min-w-0 flex-1 truncate text-sm ${notification.isRead ? "font-medium text-neutral-700" : "font-semibold text-neutral-900"}`}
            >
              {notification.title}
            </p>
            <span className="shrink-0 text-xs text-neutral-400">
              {timeAgo(notification.createdAt)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500">{notification.body}</p>
          <div className="mt-2 flex items-center gap-2">
            <Chip tone={meta.tone}>{meta.label}</Chip>
            {notification.isTransactional ? <Chip tone="neutral">Account</Chip> : null}
          </div>
        </div>
        {!notification.isRead ? (
          <span
            aria-label="Unread"
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600"
          />
        ) : null}
      </button>
    </Card>
  );
}
