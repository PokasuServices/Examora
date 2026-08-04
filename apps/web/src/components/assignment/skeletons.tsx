import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function AssignmentLandingSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Card>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-6 w-10" />
            </div>
          ))}
        </div>
      </Card>
      <Skeleton className="h-32 w-full rounded-card" />
      <Skeleton className="h-11 w-40 rounded-md" />
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-40 w-full rounded-card" />
      <Skeleton className="h-32 w-full rounded-card" />
      <Skeleton className="h-24 w-full rounded-card" />
    </div>
  );
}
