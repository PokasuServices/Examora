import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { CardRail } from "@/components/ui/card-rail";
import { CourseCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { RecommendationCardSkeleton } from "./skeletons";

/**
 * Shared rail-section shell (icon + title + status handling) used by every
 * section on Recommendations Home. Loading/error/empty are true UI states;
 * "disabled by an admin kill-switch" and "genuinely nothing yet" are
 * indistinguishable from this student-scoped API (RecommendationService
 * returns [] for both), so — matching the Dashboard's own RecommendedCourses
 * widget precedent — there is exactly one honest empty state per section,
 * not a fabricated "this was turned off" message.
 */
export function RecommendationSection({
  icon: Icon,
  title,
  subtitle,
  action,
  status,
  isEmpty,
  emptyHeading,
  emptyBody,
  emptyActionLabel,
  emptyActionHref,
  onRetry,
  skeletonVariant = "course",
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Optional trailing link/button next to the title, e.g. "View full path →". */
  action?: React.ReactNode;
  status: "loading" | "ready" | "error";
  isEmpty: boolean;
  emptyHeading: string;
  emptyBody: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  onRetry: () => void;
  skeletonVariant?: "course" | "generic";
  children: React.ReactNode;
}) {
  const Skeleton = skeletonVariant === "course" ? CourseCardSkeleton : RecommendationCardSkeleton;

  return (
    <section aria-labelledby={`rec-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={18} strokeWidth={1.75} className="text-accent-500" aria-hidden="true" />
          <h2
            id={`rec-${title.replace(/\s+/g, "-").toLowerCase()}`}
            className="font-heading text-xl font-semibold text-neutral-900"
          >
            {title}
          </h2>
        </div>
        {action ?? null}
      </div>
      {subtitle ? <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p> : null}

      <div className="mt-4">
        {status === "loading" ? (
          <CardRail>
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </CardRail>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load this section" onRetry={onRetry} />
        ) : isEmpty ? (
          <EmptyState
            heading={emptyHeading}
            body={emptyBody}
            actionLabel={emptyActionLabel}
            actionHref={emptyActionHref}
          />
        ) : (
          <CardRail>{children}</CardRail>
        )}
      </div>
    </section>
  );
}
