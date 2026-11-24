"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, ListTree } from "lucide-react";
import { ProgressBar } from "@/components/progress-bar";
import { RequireAuth } from "@/components/require-auth";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { ProgressStatusChip } from "@/components/student/subject-visual";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useLearnApi } from "@/lib/learn-api";

function SubjectContent() {
  const { id } = useParams<{ id: string }>();
  const api = useLearnApi();
  const { data, errorStatus, loading, reload } = useLoad(() => api.getSubject(id), id);

  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !data) return <LoadingPanel />;

  const done = data.topics.filter((t) => t.percent >= 100).length;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={data.subject.title}
        subtitle={
          data.subject.description ??
          `${done} of ${data.topics.length} topics complete in ${data.crumbs.course.title}.`
        }
        trail={[{ label: data.crumbs.course.title, href: "/learn" }]}
      />
      <Card density="compact" className="p-0">
        {data.topics.length === 0 ? (
          <EmptyState
            icon={ListTree}
            heading="No topics yet"
            body="Topics appear here once they're published."
          />
        ) : (
          <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {data.topics.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/learn/topics/${t.id}`}
                  className="grid grid-cols-[2rem_1fr_auto] items-center gap-4 px-4 py-4 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/[0.03] sm:grid-cols-[2rem_1fr_12rem_auto]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600 dark:bg-white/5 dark:text-neutral-400">
                    {t.position}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-neutral-800 dark:text-white/90">
                      {t.title}
                    </span>
                    {t.description ? (
                      <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {t.description}
                      </span>
                    ) : null}
                    <span className="mt-1.5 block sm:hidden">
                      <ProgressBar percent={t.percent} />
                    </span>
                  </span>
                  <span className="hidden items-center gap-3 sm:flex">
                    <ProgressBar percent={t.percent} />
                    <span className="w-10 text-right text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                      {t.percent}%
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <ProgressStatusChip percent={t.percent} />
                    <ChevronRight size={16} aria-hidden="true" className="text-neutral-400" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </main>
  );
}

export default function SubjectPage() {
  return (
    <RequireAuth>
      <SubjectContent />
    </RequireAuth>
  );
}
