import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { IconBadge } from "./icon-badge";

/** Mirrors apps/web's EmptyState exactly. */
export function EmptyState({
  icon,
  tone = "neutral",
  heading,
  body,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon?: LucideIcon;
  tone?: "neutral" | "success" | "primary";
  heading: string;
  body?: string;
  actionLabel?: string;
  actionHref?: string;
  /** Alternative to actionHref for in-page actions (e.g. "Clear filters") that don't navigate. */
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      {icon ? <IconBadge icon={icon} tone={tone} /> : null}
      <p className="text-sm font-medium text-neutral-800">{heading}</p>
      {body ? <p className="max-w-xs text-sm text-neutral-500">{body}</p> : null}
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-1 text-sm font-medium text-primary-600 hover:underline"
        >
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
