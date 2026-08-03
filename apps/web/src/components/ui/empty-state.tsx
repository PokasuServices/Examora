import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { IconBadge } from "./icon-badge";

export function EmptyState({
  icon,
  tone = "neutral",
  heading,
  body,
  actionLabel,
  actionHref,
}: {
  icon?: LucideIcon;
  tone?: "neutral" | "success" | "primary";
  heading: string;
  body?: string;
  actionLabel?: string;
  actionHref?: string;
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
    </div>
  );
}
