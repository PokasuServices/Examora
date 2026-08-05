import { Skeleton } from "@/components/ui/skeleton";

export function ThreadCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-card border border-neutral-900/[0.06] bg-white p-4 shadow-soft sm:gap-4">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </div>
    </div>
  );
}

export function ThreadCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <ThreadCardSkeleton key={i} />
      ))}
    </div>
  );
}
