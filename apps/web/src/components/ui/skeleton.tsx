import { cn } from "@examora/ui";

/** Shimmer placeholder block — respects prefers-reduced-motion (see globals.css). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-neutral-200/70", className)} />;
}

/** A skeleton matching CourseCard's shape, for Continue Learning / Recommended rails. */
export function CourseCardSkeleton() {
  return (
    <div className="w-64 shrink-0 rounded-card border border-neutral-900/[0.06] bg-white p-4 shadow-soft">
      <Skeleton className="h-24 w-full rounded-md" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
    </div>
  );
}

/** A skeleton matching CatalogCourseCard's shape — full-width grid tile, not the rail's fixed w-64. */
export function CatalogCourseCardSkeleton() {
  return (
    <div className="flex flex-col rounded-card border border-neutral-900/[0.06] bg-white p-4 shadow-soft">
      <Skeleton className="h-28 w-full rounded-md" />
      <Skeleton className="mt-3 h-4 w-20 rounded-full" />
      <Skeleton className="mt-3 h-4 w-4/5" />
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-1.5 h-3 w-2/3" />
      <Skeleton className="mt-4 h-9 w-full rounded-md" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-card border border-neutral-900/[0.06] bg-white p-6 shadow-soft">
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="mt-4 h-3 w-20" />
      <Skeleton className="mt-2 h-8 w-16" />
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="mt-1.5 h-3 w-1/3" />
      </div>
    </div>
  );
}
