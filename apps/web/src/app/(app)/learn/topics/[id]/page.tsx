"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle, FileQuestion } from "lucide-react";
import type { LearnTopicDetail, TopicRatingValue } from "@examora/types";
import { ProgressBar } from "@/components/progress-bar";
import { RequireAuth } from "@/components/require-auth";
import { learnTrail } from "@/components/student/learn-trail";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useLearnApi } from "@/lib/learn-api";

const LEVEL_LABEL = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" } as const;

const CONFIDENCE: { value: string; label: string }[] = [
  { value: "1", label: "Not yet" },
  { value: "2", label: "Shaky" },
  { value: "3", label: "Okay" },
  { value: "4", label: "Good" },
  { value: "5", label: "Confident" },
];

function LessonsCard({ data }: { data: LearnTopicDetail }) {
  return (
    <Card density="compact" className="p-0">
      <h2 className="border-b border-neutral-200 px-4 py-3 text-base font-medium text-neutral-800 dark:border-neutral-800 dark:text-white/90">
        Lessons
      </h2>
      <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {data.lessons.map((l, i) => (
          <li key={l.id}>
            <Link
              href={`/learn/lessons/${l.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/[0.03]"
            >
              {l.completed ? (
                <CheckCircle2
                  size={20}
                  className="shrink-0 text-success-600"
                  aria-label="Completed"
                />
              ) : (
                <Circle
                  size={20}
                  className="shrink-0 text-neutral-300 dark:text-neutral-600"
                  aria-label="Not completed"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                  Lesson {i + 1}
                </span>
                <span className="block text-sm font-medium text-neutral-800 dark:text-white/90">
                  {l.title}
                </span>
              </span>
              <Chip tone={l.completed ? "success" : "neutral"}>
                {l.completed ? `Earned ${l.xpReward} XP` : `+${l.xpReward} XP`}
              </Chip>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function QuizzesCard({ data }: { data: LearnTopicDetail }) {
  if (data.quizzes.length === 0) return null;
  return (
    <Card density="compact" className="p-0">
      <h2 className="border-b border-neutral-200 px-4 py-3 text-base font-medium text-neutral-800 dark:border-neutral-800 dark:text-white/90">
        Check yourself
      </h2>
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {data.quizzes.map((q) => (
          <li key={q.id}>
            <Link
              href={`/learn/quizzes/${q.id}`}
              className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/[0.03]"
            >
              <FileQuestion
                size={20}
                aria-hidden="true"
                className="shrink-0 text-primary-600 dark:text-primary-400"
              />
              <span className="min-w-0 flex-1 text-sm font-medium text-neutral-800 dark:text-white/90">
                {q.title}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {q.level ? <Chip tone="neutral">{LEVEL_LABEL[q.level]}</Chip> : null}
                <Chip tone="neutral">
                  {q.maxAttempts === null
                    ? `${q.attemptsUsed} attempt${q.attemptsUsed === 1 ? "" : "s"}`
                    : `${q.attemptsUsed}/${q.maxAttempts} attempts`}
                </Chip>
                <Chip tone={q.attempted ? "success" : "warning"}>
                  {q.attempted ? "Done" : `+${q.xpReward} XP`}
                </Chip>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ProgressCard({ data }: { data: LearnTopicDetail }) {
  const lessonsDone = data.lessons.filter((l) => l.completed).length;
  const quizzesDone = data.quizzes.filter((q) => q.attempted).length;
  const total = data.lessons.length + data.quizzes.length;
  const percent = total === 0 ? 0 : Math.round(((lessonsDone + quizzesDone) / total) * 100);

  return (
    <Card>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Your progress</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-neutral-800 dark:text-white/90">
        {percent}%
      </p>
      <div className="mt-3">
        <ProgressBar percent={percent} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-neutral-500 dark:text-neutral-400">Lessons</dt>
          <dd className="font-medium text-neutral-800 dark:text-white/90">
            {lessonsDone} / {data.lessons.length}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500 dark:text-neutral-400">Quizzes</dt>
          <dd className="font-medium text-neutral-800 dark:text-white/90">
            {quizzesDone} / {data.quizzes.length}
          </dd>
        </div>
      </dl>

      <h3 className="mt-6 text-sm font-medium text-neutral-800 dark:text-white/90">Up next</h3>
      {data.suggestions.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          You&rsquo;ve finished this topic.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {data.suggestions.map((s) => (
            <li key={s.id}>
              <Link
                href={s.kind === "lesson" ? `/learn/lessons/${s.id}` : `/learn/quizzes/${s.id}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-500/10"
              >
                <span className="truncate">{s.title}</span>
                <ArrowRight size={14} aria-hidden="true" className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ConfidenceCard({
  topicId,
  initial,
}: {
  topicId: string;
  initial: TopicRatingValue | null;
}) {
  const api = useLearnApi();
  const [value, setValue] = React.useState<string>(initial ? String(initial) : "");
  const [state, setState] = React.useState<"idle" | "saved" | "error">("idle");

  async function choose(next: string) {
    const previous = value;
    setValue(next);
    setState("idle");
    try {
      await api.rateTopic(topicId, Number(next) as TopicRatingValue);
      setState("saved");
    } catch {
      setValue(previous);
      setState("error");
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">
        How confident are you with this topic?
      </h2>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Helps you (and your mentor) decide what to revise.
      </p>
      <div className="mt-3 overflow-x-auto">
        <SegmentedControl
          aria-label="Confidence"
          options={CONFIDENCE}
          value={value}
          onChange={(v) => void choose(v)}
        />
      </div>
      <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs">
        {state === "saved" ? <span className="text-success-600">Saved</span> : null}
        {state === "error" ? (
          <span className="text-danger-600">Couldn&rsquo;t save. Try again.</span>
        ) : null}
      </p>
    </Card>
  );
}

function TopicContent() {
  const { id } = useParams<{ id: string }>();
  const api = useLearnApi();
  const { data, errorStatus, loading, reload } = useLoad(() => api.getTopic(id), id);

  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !data) return <LoadingPanel />;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={data.topic.title}
        subtitle={data.topic.description ?? undefined}
        trail={learnTrail(data.crumbs, "subject")}
      />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <LessonsCard data={data} />
          <QuizzesCard data={data} />
        </div>
        <div className="flex flex-col gap-6">
          <ProgressCard data={data} />
          <ConfidenceCard topicId={data.topic.id} initial={data.myRating} />
        </div>
      </div>
    </main>
  );
}

export default function TopicPage() {
  return (
    <RequireAuth>
      <TopicContent />
    </RequireAuth>
  );
}
