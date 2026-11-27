"use client";

import * as React from "react";
import Link from "next/link";
import { Brush, ClipboardList, Clock, Inbox, Layers, Timer } from "lucide-react";
import type { ReviewInbox, ReviewKind } from "@examora/types";
import { cn } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { Pill, StatTile, ToneCard, ToneIcon, timeAgo, type Tone } from "@/components/desk-ui";
import { useDeskApi } from "@/lib/desk-api";

const KIND: Record<ReviewKind, { label: string; tone: Tone; icon: typeof Brush }> = {
  SKETCH: { label: "Test sketch", tone: "violet", icon: Brush },
  REVISION: { label: "Part B / revision", tone: "cyan", icon: Layers },
  ASSIGNMENT: { label: "Assignment", tone: "amber", icon: ClipboardList },
};

function waitTone(h: number | null): Tone {
  if (h === null) return "slate";
  if (h > 72) return "rose";
  if (h > 24) return "amber";
  return "emerald";
}

function ReviewsContent() {
  const api = useDeskApi();
  const [data, setData] = React.useState<ReviewInbox | null>(null);
  const [error, setError] = React.useState(false);
  const [filter, setFilter] = React.useState<ReviewKind | "ALL">("ALL");
  const load = React.useCallback(() => {
    setError(false);
    api
      .reviews()
      .then(setData)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => load(), [load]);

  const items = (data?.items ?? []).filter((i) => filter === "ALL" || i.kind === filter);
  const total = data ? data.counts.SKETCH + data.counts.REVISION + data.counts.ASSIGNMENT : 0;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Review inbox"
        subtitle="Work from students in your batches. Only you, their batch mentor, mark it. Oldest first."
      />
      {error ? (
        <RetryInline message="Couldn't load your inbox" onRetry={load} />
      ) : !data ? (
        <Card className="text-sm text-neutral-500">Loading…</Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              index={0}
              tone="indigo"
              icon={Inbox}
              label="Waiting"
              value={total}
              hint="Across sketches and assignments"
            />
            <StatTile
              index={1}
              tone="violet"
              icon={Brush}
              label="Sketches"
              value={data.counts.SKETCH + data.counts.REVISION}
              hint={`${data.counts.REVISION} Part B / revisions`}
            />
            <StatTile
              index={2}
              tone="amber"
              icon={ClipboardList}
              label="Assignments"
              value={data.counts.ASSIGNMENT}
            />
            <StatTile
              index={3}
              tone="emerald"
              icon={Timer}
              label="Your marking time"
              value={
                data.avgTurnaroundHours === null
                  ? "—"
                  : data.avgTurnaroundHours < 48
                    ? `${data.avgTurnaroundHours} h`
                    : `${Math.round(data.avgTurnaroundHours / 24)} d`
              }
              hint={`${data.doneLast30} marked in the last 30 days`}
            />
          </section>

          <div role="tablist" aria-label="Filter" className="flex flex-wrap gap-1.5">
            {(["ALL", "SKETCH", "REVISION", "ASSIGNMENT"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  filter === k
                    ? "bg-primary-600 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
                )}
              >
                {k === "ALL" ? "Everything" : KIND[k].label}
                <span className="ml-1 opacity-75">{k === "ALL" ? total : data.counts[k]}</span>
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <Card>
              <EmptyState
                icon={Inbox}
                heading="Nothing waiting"
                body="New work from your batches shows up here."
              />
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((i, n) => {
                const k = KIND[i.kind];
                return (
                  <li key={`${i.kind}-${i.id}`}>
                    <Link
                      href={i.href}
                      className="block rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <ToneCard tone={k.tone} index={Math.min(n, 12)} interactive className="p-4">
                        <div className="flex items-start gap-3">
                          <ToneIcon tone={k.tone} icon={k.icon} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-neutral-900 dark:text-white">
                                {i.student.name}
                              </p>
                              <Pill tone={k.tone}>{k.label}</Pill>
                            </div>
                            <p className="mt-0.5 text-sm text-neutral-700 dark:text-neutral-200">
                              {i.title}
                            </p>
                            {i.detail ? (
                              <p className="mt-0.5 truncate text-xs text-neutral-500">{i.detail}</p>
                            ) : null}
                          </div>
                          <div className="shrink-0 text-right">
                            <Pill tone={waitTone(i.waitingHours)}>
                              <Clock size={11} aria-hidden="true" />
                              {i.waitingHours === null
                                ? "—"
                                : i.waitingHours < 48
                                  ? `${i.waitingHours} h`
                                  : `${Math.round(i.waitingHours / 24)} days`}
                            </Pill>
                            <p className="mt-1 text-[11px] text-neutral-500">
                              {timeAgo(i.submittedAt)}
                            </p>
                          </div>
                        </div>
                      </ToneCard>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

export default function ReviewsPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <ReviewsContent />
    </RequirePermission>
  );
}
