import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function CourseHeroSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-neutral-900/[0.06] bg-white shadow-soft">
      <Skeleton className="h-40 w-full rounded-none sm:h-52" />
      <div className="flex flex-col gap-4 p-6 sm:p-8">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-11 w-40 rounded-md" />
      </div>
    </div>
  );
}

export function CourseSidebarSkeleton() {
  return (
    <Card>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="mt-4 h-11 w-full rounded-md" />
      <Skeleton className="mt-6 h-4 w-32" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-3/4" />
    </Card>
  );
}

export function CurriculumSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} density="compact">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/4" />
        </Card>
      ))}
    </div>
  );
}
