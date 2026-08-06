import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ChartCardSkeleton() {
  return (
    <Card>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-1.5 h-3 w-48" />
      <Skeleton className="mt-4 h-64 w-full rounded-md" />
    </Card>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="mt-4 h-3 w-20" />
          <Skeleton className="mt-2 h-8 w-16" />
        </Card>
      ))}
    </div>
  );
}
