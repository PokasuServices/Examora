import { Lock, SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingPanel() {
  return (
    <Card aria-busy="true" aria-label="Loading">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-3/4" />
    </Card>
  );
}

/** Error body chosen by HTTP status: no licence, not found, or a retryable failure. */
export function ErrorPanel({ status, onRetry }: { status: number | null; onRetry: () => void }) {
  if (status === 403) {
    return (
      <Card>
        <EmptyState
          icon={Lock}
          heading="This course isn't assigned to you"
          body="Courses are assigned by your institute. Ask your administrator for access."
        />
      </Card>
    );
  }
  if (status === 404) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          heading="Not found"
          body="It may have been removed or unpublished."
          actionLabel="Back to Learn"
          actionHref="/learn"
        />
      </Card>
    );
  }
  return (
    <Card>
      <RetryInline message="Couldn't load this page." onRetry={onRetry} />
    </Card>
  );
}
