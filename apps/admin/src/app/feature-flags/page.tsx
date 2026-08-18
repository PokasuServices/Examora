"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import { FieldError } from "@examora/ui";
import type { RecommendationFeatureFlagDto } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecommendationFeatureFlagsApi } from "@/lib/recommendations-api";

const TYPE_LABELS: Record<RecommendationFeatureFlagDto["type"], string> = {
  COURSE: "Course Recommendations",
  SIMILAR_COURSES: "Similar Courses",
  LEARNING_PATH: "Learning Path Recommendations",
  CONTINUE_LEARNING: "Continue Learning",
  QUIZ: "Quiz Recommendations",
  ASSIGNMENT: "Assignment Recommendations",
  COMMUNITY_DISCUSSION: "Related Community Discussions",
};

function FeatureFlagsContent() {
  const api = useRecommendationFeatureFlagsApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [flags, setFlags] = React.useState<RecommendationFeatureFlagDto[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .list()
      .then((res) => {
        setFlags(res);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function toggle(flag: RecommendationFeatureFlagDto): Promise<void> {
    setError(null);
    try {
      await api.setEnabled(flag.type, !flag.isEnabled);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update feature flag");
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Recommendation feature flags"
        subtitle="Disable a recommendation type platform-wide without a deploy."
      />

      <FieldError>{error}</FieldError>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load feature flags" onRetry={load} />
        ) : flags.length === 0 ? (
          <EmptyState icon={Sparkles} heading="No feature flags found" />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Recommendation type
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Last updated by
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {flags.map((flag) => (
                  <tr key={flag.type} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">
                      {TYPE_LABELS[flag.type]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={flag.isEnabled ? "success" : "neutral"}>
                        {flag.isEnabled ? "Enabled" : "Disabled"}
                      </Chip>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {flag.updatedByEmail
                        ? `${flag.updatedByEmail} · ${new Date(flag.updatedAt!).toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void toggle(flag)}
                        className="text-sm font-medium text-primary-600 hover:underline"
                      >
                        {flag.isEnabled ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}

export default function FeatureFlagsPage() {
  return (
    <RequirePermission permission="recommendations:admin">
      <FeatureFlagsContent />
    </RequirePermission>
  );
}
