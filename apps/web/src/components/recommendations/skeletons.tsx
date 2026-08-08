import { Skeleton } from "@/components/ui/skeleton";

/** Same w-64 tile shape as CourseCardSkeleton, for the non-course recommendation rails. */
export function RecommendationCardSkeleton() {
  return (
    <div className="w-64 shrink-0 rounded-card border border-neutral-900/[0.06] bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-3 w-3/4" />
      <Skeleton className="mt-4 h-3 w-full" />
    </div>
  );
}
