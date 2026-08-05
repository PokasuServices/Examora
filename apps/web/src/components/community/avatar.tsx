import type { CommunityAuthorSummary } from "@examora/types";
import { authorInitials } from "@/lib/format";

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-14 w-14 text-lg",
} as const;

/** No avatar image field exists on CommunityAuthorSummary — an initials badge, same soft-tint pattern as IconBadge. */
export function Avatar({
  author,
  size = "md",
}: {
  author: CommunityAuthorSummary;
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary-500/10 font-heading font-semibold text-primary-700 ${SIZE_CLASSES[size]}`}
    >
      {authorInitials(author)}
    </span>
  );
}
