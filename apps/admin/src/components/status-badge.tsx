import type { ContentStatus } from "@examora/types";

const STYLES: Record<ContentStatus, string> = {
  DRAFT: "bg-neutral-200 text-neutral-700",
  PUBLISHED: "bg-success-500/10 text-success-600",
  ARCHIVED: "bg-warning-500/10 text-warning-600",
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}
