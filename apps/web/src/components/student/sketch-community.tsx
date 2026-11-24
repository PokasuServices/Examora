"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, Lock } from "lucide-react";
import type { SketchCommunityCard } from "@examora/types";
import { Button } from "@examora/ui";
import { StudyImage } from "@/components/student/study-image";
import { Chip } from "@/components/ui/chip";
import { SelectField } from "@/components/ui/select-field";
import { useStudentApi } from "@/lib/student-api";

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "claps", label: "Most claps" },
  { value: "top", label: "Top community score" },
];
const FILTERS = [
  { value: "all", label: "All sketches" },
  { value: "unrated", label: "Not rated by me" },
  { value: "rated", label: "Rated by me" },
];

/** Classmates' latest sketches for a question, after you've rated your own. */
export function SketchCommunity({
  questionId,
  refreshKey = 0,
}: {
  questionId: string;
  refreshKey?: number;
}) {
  const api = useStudentApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const [sort, setSort] = React.useState("newest");
  const [filter, setFilter] = React.useState("all");
  const [items, setItems] = React.useState<SketchCommunityCard[] | null>(null);
  const [unlocked, setUnlocked] = React.useState(true);
  const [maxMarks, setMaxMarks] = React.useState(10);
  const [nextPage, setNextPage] = React.useState<number | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const ids = React.useId();

  React.useEffect(() => {
    setItems(null);
    setFailed(false);
    apiRef.current
      .sketchCommunity(questionId, { sort, filter, page: 1 })
      .then((page) => {
        setUnlocked(page.unlocked);
        setMaxMarks(page.maxMarks);
        setItems(page.items);
        setNextPage(page.nextPage);
      })
      .catch(() => setFailed(true));
  }, [questionId, sort, filter, refreshKey]);

  async function more() {
    if (!nextPage) return;
    setLoadingMore(true);
    try {
      const page = await api.sketchCommunity(questionId, { sort, filter, page: nextPage });
      setItems((p) => [...(p ?? []), ...page.items]);
      setNextPage(page.nextPage);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section
      id={`community-${questionId}`}
      aria-labelledby={`${ids}-h`}
      className="flex flex-col gap-3 scroll-mt-24"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={`${ids}-h`} className="text-base font-medium text-neutral-800 dark:text-white/90">
          Classmates&rsquo; sketches
        </h2>
        {unlocked ? (
          <div className="flex flex-wrap gap-3">
            <div className="w-44">
              <SelectField
                id={`${ids}-filter`}
                label="Show"
                value={filter}
                options={FILTERS}
                onChange={setFilter}
              />
            </div>
            <div className="w-48">
              <SelectField
                id={`${ids}-sort`}
                label="Sort"
                value={sort}
                options={SORTS}
                onChange={setSort}
              />
            </div>
          </div>
        ) : null}
      </div>
      {failed ? (
        <p className="text-sm text-danger-600">Couldn&rsquo;t load classmates&rsquo; sketches.</p>
      ) : !unlocked ? (
        <p className="flex items-center gap-2 rounded-md bg-success-50 px-3 py-3 text-sm text-success-800 dark:bg-success-500/10 dark:text-success-200">
          <Lock size={16} aria-hidden="true" />
          Upload your sketch and rate it yourself first to see classmates&rsquo; work and learn from
          it.
        </p>
      ) : items === null ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {filter === "all"
            ? "No classmates have shared a sketch for this question yet."
            : "Nothing here with this filter."}
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((c) => (
              <li key={c.workId}>
                <Link
                  href={`/practice/sketches/work/${c.workId}`}
                  className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-200 bg-white hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <StudyImage
                    src={c.imageRef}
                    alt={`Sketch by ${c.ownerName}`}
                    className="aspect-[4/3] w-full rounded-none object-cover"
                  />
                  <span className="flex flex-1 flex-col gap-1 p-2.5 text-xs">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-neutral-800 dark:text-white/90">
                        {c.ownerName}
                      </span>
                      <span className="shrink-0 text-neutral-500">{c.versionLabel}</span>
                    </span>
                    {c.description ? (
                      <span className="line-clamp-2 text-neutral-600 dark:text-neutral-400">
                        {c.description}
                      </span>
                    ) : null}
                    <span className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-neutral-500">
                      <span className="inline-flex items-center gap-1">
                        <Eye size={12} aria-hidden="true" /> {c.views}
                      </span>
                      <span>👏 {c.claps}</span>
                      {c.communityTotal !== null ? (
                        <span>
                          {c.communityTotal}/{maxMarks} · {c.feedbackCount} rated
                        </span>
                      ) : null}
                    </span>
                    <span className="pt-1">
                      {c.ratedByMe ? (
                        <Chip tone="success">Rated by you</Chip>
                      ) : (
                        <Chip tone="warning">Rate for +25 XP</Chip>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {nextPage ? (
            <div>
              <Button
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={() => void more()}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
