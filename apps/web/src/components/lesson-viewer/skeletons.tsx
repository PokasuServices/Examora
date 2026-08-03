import { Skeleton } from "@/components/ui/skeleton";

export function LessonViewerSkeleton() {
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-8 w-1/2" />
      <div className="flex gap-8">
        <div className="flex-1 space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="hidden h-64 w-[300px] shrink-0 rounded-card lg:block" />
      </div>
    </div>
  );
}
