"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { RecommendationFeatureFlagDto } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
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
  const [flags, setFlags] = React.useState<RecommendationFeatureFlagDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .list()
      .then(setFlags)
      .catch(() => undefined)
      .finally(() => setLoading(false));
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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-heading">Recommendation feature flags</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Disable a recommendation type platform-wide without a deploy (ADR-0021).
      </p>

      {error ? <p className="mt-3 text-sm text-error-600">{error}</p> : null}
      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}

      {!loading ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Recommendation type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last updated by</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.type} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 text-neutral-800">{TYPE_LABELS[flag.type]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        flag.isEnabled
                          ? "bg-success-50 text-success-700"
                          : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {flag.isEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {flag.updatedByEmail
                      ? `${flag.updatedByEmail} · ${new Date(flag.updatedAt!).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void toggle(flag)}
                      className="text-primary-600 hover:underline"
                    >
                      {flag.isEnabled ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
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
