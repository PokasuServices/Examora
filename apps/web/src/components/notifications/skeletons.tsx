import { Skeleton } from "@/components/ui/skeleton";

export function NotificationCardSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-card border border-neutral-900/[0.06] bg-white p-4 shadow-soft">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="mt-2 h-3 w-full" />
        <Skeleton className="mt-2 h-4 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function NotificationCardSkeletonList({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <NotificationCardSkeleton key={i} />
      ))}
    </div>
  );
}
