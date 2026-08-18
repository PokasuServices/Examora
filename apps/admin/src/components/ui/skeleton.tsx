import { cn } from "@examora/ui";

/** Shimmer placeholder block — respects prefers-reduced-motion (see globals.css). Mirrors apps/web's Skeleton. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-neutral-200/70", className)} />;
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

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[160px]" />
        </td>
      ))}
    </tr>
  );
}
