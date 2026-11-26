"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Annoyed,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileQuestion,
  Frown,
  Laugh,
  Layers,
  Lightbulb,
  Meh,
  Smile,
  Trophy,
  Zap,
} from "lucide-react";
import type { LearnTopicDetail, TopicRatingValue } from "@examora/types";
import { cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { learnTrail } from "@/components/student/learn-trail";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { PerformanceView } from "@/components/student/test-performance-chart";
import { useLoad } from "@/components/student/use-load";
import { ExamTagChips, TopicMarkButtons } from "@/components/student/learn-dashboard";
import { WeakTopicCards } from "@/components/student/weak-topics";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField } from "@/components/ui/select-field";
import { stagger, ToneCard, ToneIcon, toneClasses, type Tone } from "@/components/ui/tone-card";
import { useLearnApi } from "@/lib/learn-api";
import { useStudentApi } from "@/lib/student-api";

const LEVEL: Record<"EASY" | "MEDIUM" | "HARD", { label: string; tone: Tone }> = {
  EASY: { label: "Easy", tone: "emerald" },
  MEDIUM: { label: "Medium", tone: "amber" },
  HARD: { label: "Hard", tone: "rose" },
};

const CONFIDENCE: { value: TopicRatingValue; label: string; icon: typeof Smile; tone: string }[] = [
  {
    value: 1,
    label: "Not yet",
    icon: Frown,
    tone: "text-rose-600 bg-rose-50 ring-rose-200 dark:bg-rose-500/15 dark:ring-rose-500/30",
  },
  {
    value: 2,
    label: "Shaky",
    icon: Annoyed,
    tone: "text-orange-600 bg-orange-50 ring-orange-200 dark:bg-orange-500/15 dark:ring-orange-500/30",
  },
  {
    value: 3,
    label: "Okay",
    icon: Meh,
    tone: "text-amber-600 bg-amber-50 ring-amber-200 dark:bg-amber-500/15 dark:ring-amber-500/30",
  },
  {
    value: 4,
    label: "Good",
    icon: Smile,
    tone: "text-lime-700 bg-lime-50 ring-lime-200 dark:bg-lime-500/15 dark:ring-lime-500/30",
  },
  {
    value: 5,
    label: "Confident",
    icon: Laugh,
    tone: "text-emerald-600 bg-emerald-50 ring-emerald-200 dark:bg-emerald-500/15 dark:ring-emerald-500/30",
  },
];

const JUMP_LINK =
  "inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900";

/** Thin animated progress bar in a tone colour. */
function ToneBar({ percent, tone }: { percent: number; tone: Tone }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-inset ring-neutral-200 dark:bg-white/10 dark:ring-white/10"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${percent}% done`}
    >
      <div
        className={cn(
          "h-full origin-left rounded-full motion-safe:animate-grow-x",
          toneClasses(tone).line,
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** "My actions": what to do next in this topic, plus course topics to revise. */
function MyActions({ data }: { data: LearnTopicDetail }) {
  const api = useStudentApi();
  const courseId = data.crumbs.course.id;
  const weak = useLoad(() => api.practice(courseId), `weak-${courseId}`);
  const [studied, setStudied] = React.useState<Set<string>>(new Set());
  const topics = (weak.data?.weakTopics ?? []).filter((t) => !studied.has(t.topicId));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-medium text-neutral-800 dark:text-white/90">
          Up next in this topic
        </h3>
        {data.suggestions.length === 0 ? (
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
            You&rsquo;ve finished every lesson and quiz here. Nicely done.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.suggestions.map((s, i) => (
              <li
                key={`${s.kind}-${s.id}`}
                className="motion-safe:animate-fade-up"
                style={stagger(i)}
              >
                <Link
                  href={s.kind === "lesson" ? `/learn/lessons/${s.id}` : `/learn/quizzes/${s.id}`}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    s.kind === "lesson"
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                      : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
                  )}
                >
                  {s.kind === "lesson" ? (
                    <BookOpen size={14} aria-hidden="true" />
                  ) : (
                    <FileQuestion size={14} aria-hidden="true" />
                  )}
                  {s.title}
                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-neutral-800 dark:text-white/90">
          Topics to revise
        </h3>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          From your tests in {data.crumbs.course.title}: answers you were sure of that turned out
          wrong.
        </p>
        {weak.errorStatus !== null ? (
          <p className="text-sm text-danger-600">
            Couldn&rsquo;t load this.{" "}
            <button type="button" onClick={weak.reload} className="font-medium underline">
              Retry
            </button>
          </p>
        ) : weak.loading && !weak.data ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : topics.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Nothing to revise right now. Keep taking tests and we&rsquo;ll flag weak spots here.
          </p>
        ) : (
          <WeakTopicCards
            topics={topics}
            currentTopicId={data.topic.id}
            onStudied={(id) => setStudied((prev) => new Set(prev).add(id))}
          />
        )}
      </div>
    </div>
  );
}

/** "My test performance": first-attempt scores, pick a course and a test category. */
function MyTestPerformance({ data }: { data: LearnTopicDetail }) {
  const learnApi = useLearnApi();
  const studentApi = useStudentApi();
  const courses = useLoad(() => learnApi.listCourses(), "licensed-courses");
  const [courseId, setCourseId] = React.useState(data.crumbs.course.id);
  const [categoryId, setCategoryId] = React.useState("");
  const overview = useLoad(() => studentApi.practice(courseId), `perf-${courseId}`);
  const categories = overview.data?.categories ?? [];

  React.useEffect(() => setCategoryId(""), [courseId]);

  const courseOptions = (courses.data ?? []).map((c) => ({ value: c.id, label: c.title }));
  if (!courseOptions.some((c) => c.value === courseId)) {
    courseOptions.unshift({ value: courseId, label: data.crumbs.course.title });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:w-2/3">
        <SelectField
          id="perf-course"
          label="Course"
          value={courseId}
          options={courseOptions}
          onChange={setCourseId}
        />
        <SelectField
          id="perf-category"
          label="Tests"
          value={categoryId}
          options={[
            { value: "", label: "All practice tests" },
            ...categories.map((c) => ({ value: c.id, label: c.title })),
          ]}
          onChange={setCategoryId}
        />
      </div>
      <PerformanceView
        courseId={courseId}
        categoryId={categoryId || undefined}
        emptyText="No finished tests here yet. Take one in Practice to see your scores, split by how you answered."
      />
    </div>
  );
}

function SuggestionsPanel({ data }: { data: LearnTopicDetail }) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"actions" | "performance">("actions");
  const panelId = React.useId();

  return (
    <Card className="p-0 motion-safe:animate-fade-up" style={stagger(3)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-card px-5 py-4 text-left hover:bg-violet-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-violet-500/5"
      >
        <ToneIcon tone="violet" icon={Lightbulb} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-neutral-800 dark:text-white/90">
            My suggestions
          </span>
          <span className="block text-xs text-neutral-500 dark:text-neutral-400">
            What to do next, topics to revise, and your test scores.
          </span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cn(
            "text-neutral-400 transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div
          id={panelId}
          className="flex flex-col gap-5 border-t border-neutral-200 px-5 pb-5 pt-4 motion-safe:animate-fade-up dark:border-neutral-800"
        >
          <div className="overflow-x-auto">
            <SegmentedControl
              aria-label="Suggestions view"
              options={[
                { value: "actions", label: "My actions" },
                { value: "performance", label: "My test performance" },
              ]}
              value={view}
              onChange={setView}
            />
          </div>
          {view === "actions" ? <MyActions data={data} /> : <MyTestPerformance data={data} />}
        </div>
      ) : null}
    </Card>
  );
}

function SummaryCards({ data }: { data: LearnTopicDetail }) {
  const lessonsDone = data.lessons.filter((l) => l.completed).length;
  const quizzesDone = data.quizzes.filter((q) => q.attempted).length;
  const total = data.lessons.length + data.quizzes.length;
  const percent = total === 0 ? 0 : Math.round(((lessonsDone + quizzesDone) / total) * 100);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <ToneCard tone="indigo" index={0} className="flex items-start gap-4 p-5">
        <ToneIcon tone="indigo" icon={BookOpen} />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-700/80 dark:text-indigo-300/80">
            Lessons covered
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
            {lessonsDone}
            <span className="text-base font-normal text-neutral-400"> / {data.lessons.length}</span>
          </p>
          {data.lessons.length > 0 ? (
            <a
              href="#lessons"
              className={cn(
                JUMP_LINK,
                "mt-2 bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-500",
              )}
            >
              Learn <ChevronRight size={14} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </ToneCard>

      <ToneCard tone="cyan" index={1} className="flex flex-col justify-center gap-2 p-5">
        <div className="flex items-center gap-3">
          <ToneIcon tone="cyan" icon={Layers} size="sm" />
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {plural(data.lessons.length, "lesson", "lessons")} &amp;{" "}
            {plural(data.quizzes.length, "quiz", "quizzes")}
          </p>
        </div>
        <ToneBar percent={percent} tone="cyan" />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          <span className="font-semibold text-cyan-700 dark:text-cyan-300">{percent}%</span> of this
          topic done
        </p>
      </ToneCard>

      <ToneCard tone="amber" index={2} className="flex items-start gap-4 p-5">
        <ToneIcon tone="amber" icon={Trophy} />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">
            Quizzes attempted
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
            {quizzesDone}
            <span className="text-base font-normal text-neutral-400"> / {data.quizzes.length}</span>
          </p>
          {data.quizzes.length > 0 ? (
            <a
              href="#quizzes"
              className={cn(
                JUMP_LINK,
                "mt-2 bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500",
              )}
            >
              Quiz <ChevronRight size={14} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </ToneCard>
    </div>
  );
}

function XpBadge({ xp, earned }: { xp: number; earned: boolean }) {
  return earned ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
      <Check size={13} aria-hidden="true" /> {xp} XP earned
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
      <Zap size={13} aria-hidden="true" /> +{xp} XP
    </span>
  );
}

function SectionHeading({
  tone,
  icon,
  title,
  done,
  total,
}: {
  tone: Tone;
  icon: typeof BookOpen;
  title: string;
  done: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
      <ToneIcon tone={tone} icon={icon} size="sm" />
      <h2 className="flex-1 text-base font-semibold text-neutral-800 dark:text-white/90">
        {title}
      </h2>
      <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
        {done} of {total} done
      </span>
    </div>
  );
}

function LessonsCard({ data }: { data: LearnTopicDetail }) {
  const done = data.lessons.filter((l) => l.completed).length;
  return (
    <Card id="lessons" className="scroll-mt-20 overflow-hidden p-0">
      <SectionHeading
        tone="indigo"
        icon={BookOpen}
        title="Lessons"
        done={done}
        total={data.lessons.length}
      />
      {data.lessons.length === 0 ? (
        <p className="px-5 py-4 text-sm text-neutral-500">No lessons in this topic yet.</p>
      ) : (
        <ol className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {data.lessons.map((l, i) => (
            <li key={l.id} className="motion-safe:animate-fade-up" style={stagger(i, 45)}>
              <Link
                href={`/learn/lessons/${l.id}`}
                className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-indigo-50/50 focus-visible:bg-indigo-50/60 focus-visible:outline-none dark:hover:bg-indigo-500/5"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                    l.completed
                      ? "bg-emerald-500 text-white"
                      : "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30",
                  )}
                  aria-label={l.completed ? "Completed" : `Lesson ${i + 1}, not completed`}
                >
                  {l.completed ? <Check size={16} aria-hidden="true" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-neutral-800 group-hover:text-indigo-700 dark:text-white/90 dark:group-hover:text-indigo-300">
                  {l.title}
                </span>
                <XpBadge xp={l.xpReward} earned={l.completed} />
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500 motion-reduce:transition-none"
                />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function QuizzesCard({ data }: { data: LearnTopicDetail }) {
  if (data.quizzes.length === 0) return null;
  const done = data.quizzes.filter((q) => q.attempted).length;
  return (
    <Card id="quizzes" className="scroll-mt-20 overflow-hidden p-0">
      <SectionHeading
        tone="amber"
        icon={Trophy}
        title="Quizzes"
        done={done}
        total={data.quizzes.length}
      />
      <ul className="flex flex-col gap-3 p-4">
        {data.quizzes.map((q, i) => {
          const level = q.level ? LEVEL[q.level] : null;
          return (
            <li key={q.id}>
              <ToneCard tone={level?.tone ?? "slate"} index={i} interactive>
                <Link
                  href={`/learn/quizzes/${q.id}`}
                  className="group grid gap-3 px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <FileQuestion
                      size={20}
                      aria-hidden="true"
                      className={cn("shrink-0", level ? toneClasses(level.tone).text : "")}
                    />
                    <span className="text-sm font-semibold text-neutral-800 dark:text-white/90">
                      {q.title}
                    </span>
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 sm:text-center">
                    <span className="block uppercase tracking-wide">Attempts</span>
                    <span className="font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
                      {q.maxAttempts === null
                        ? `${q.attemptsUsed} · unlimited`
                        : `${q.attemptsUsed} of ${q.maxAttempts}`}
                    </span>
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 sm:text-center">
                    <span className="block uppercase tracking-wide">Level</span>
                    <span
                      className={cn(
                        "font-medium",
                        level ? toneClasses(level.tone).text : "text-neutral-600",
                      )}
                    >
                      {level?.label ?? "—"}
                    </span>
                  </span>
                  <XpBadge xp={q.xpReward} earned={q.attempted} />
                </Link>
              </ToneCard>
            </li>
          );
        })}
      </ul>
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
  const [value, setValue] = React.useState<TopicRatingValue | null>(initial);
  const [state, setState] = React.useState<"idle" | "saved" | "error">("idle");
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  async function choose(next: TopicRatingValue) {
    const previous = value;
    setValue(next);
    setState("idle");
    try {
      await api.rateTopic(topicId, next);
      setState("saved");
    } catch {
      setValue(previous);
      setState("error");
    }
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next =
      (index + (e.key === "ArrowRight" ? 1 : -1) + CONFIDENCE.length) % CONFIDENCE.length;
    void choose(CONFIDENCE[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <ToneCard tone="violet" index={0} className="flex flex-col items-center px-5 py-6 text-center">
      <h2 id="rate-topic" className="text-sm font-medium text-neutral-800 dark:text-white/90">
        How well do you understand this topic so far?
      </h2>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Helps you (and your mentor) decide what to revise.
      </p>
      <div
        role="radiogroup"
        aria-labelledby="rate-topic"
        className="mt-4 flex flex-wrap justify-center gap-2 sm:gap-3"
      >
        {CONFIDENCE.map((c, i) => {
          const selected = value === c.value;
          const Icon = c.icon;
          return (
            <button
              key={c.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (value === null && i === 0) ? 0 : -1}
              onClick={() => void choose(c.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex w-[4.5rem] flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transition-none",
                selected
                  ? cn("ring-1", c.tone, "motion-safe:scale-105")
                  : "text-neutral-500 hover:bg-white hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-white/5",
              )}
            >
              <Icon size={26} strokeWidth={1.6} aria-hidden="true" />
              {c.label}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-3 min-h-[1rem] text-xs">
        {state === "saved" ? <span className="text-emerald-600">Saved</span> : null}
        {state === "error" ? (
          <span className="text-danger-600">Couldn&rsquo;t save. Try again.</span>
        ) : null}
      </p>
    </ToneCard>
  );
}

/** Favourite / on hold, plus the exams this topic counts for. */
function TopicLabels({ data }: { data: LearnTopicDetail }) {
  const [mark, setMark] = React.useState(data.mark);
  const tags = data.topic.examTags;
  return (
    <div className="-mt-2 flex flex-wrap items-center justify-between gap-3">
      {tags.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          {tags.length >= 2 ? "Shared topic, counts for:" : "Counts for:"}
          <ExamTagChips tags={tags} />
        </p>
      ) : (
        <span />
      )}
      <TopicMarkButtons topicId={data.topic.id} value={mark} onChange={setMark} size="md" />
    </div>
  );
}

function TopicContent() {
  const { id } = useParams<{ id: string }>();
  const api = useLearnApi();
  const { data, errorStatus, loading, reload } = useLoad(() => api.getTopic(id), id);

  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !data) return <LoadingPanel />;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title={data.topic.title}
        subtitle={data.topic.description ?? undefined}
        trail={learnTrail(data.crumbs, "subject")}
      />
      <TopicLabels key={data.topic.id} data={data} />
      <SummaryCards data={data} />
      <SuggestionsPanel data={data} />
      <LessonsCard data={data} />
      <QuizzesCard data={data} />
      <ConfidenceCard topicId={data.topic.id} initial={data.myRating} />
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
