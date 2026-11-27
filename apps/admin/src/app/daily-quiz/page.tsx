"use client";

import * as React from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  Search,
  Shuffle,
  Users,
} from "lucide-react";
import type { DailyCalendarView, DailyScheduleItem } from "@examora/types";
import { Button, Input, Label, cn } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import {
  Modal,
  Pill,
  ToneCard,
  addDaysIso,
  dayLabel,
  todayIso,
  useToast,
} from "@/components/desk-ui";
import { useDeskApi, type PoolQuestion } from "@/lib/desk-api";
import { useStudentAdminApi } from "@/lib/student-admin-api";

const selectCls =
  "h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

function mondayOf(d: string) {
  const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
  return addDaysIso(d, dow === 0 ? -6 : 1 - dow);
}

function PlanDialog({
  courseId,
  date,
  existing,
  onClose,
  onSaved,
}: {
  courseId: string;
  date: string;
  existing: DailyScheduleItem | null;
  onClose: () => void;
  onSaved: (item: DailyScheduleItem) => void;
}) {
  const api = useDeskApi();
  const [title, setTitle] = React.useState(existing?.title ?? "");
  const [day, setDay] = React.useState(existing?.date ?? date);
  const [search, setSearch] = React.useState("");
  const [pool, setPool] = React.useState<PoolQuestion[]>([]);
  const [picked, setPicked] = React.useState<string[]>(existing?.questionIds ?? []);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      api
        .dailyPool(courseId, search)
        .then(setPool)
        .catch(() => setPool([]));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, search]);

  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length >= 15 ? p : [...p, id],
    );

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const item = existing
        ? await api.rescheduleDaily(existing.id, { date: day, title, questionIds: picked })
        : await api.scheduleDaily({ courseId, date: day, title, questionIds: picked });
      onSaved(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={existing ? "Change daily quiz" : "Plan a daily quiz"} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dq-title">Title</Label>
          <Input
            id="dq-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Colour theory sprint"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dq-date">Day</Label>
          <Input
            id="dq-date"
            type="date"
            min={todayIso()}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Everyone on the course gets the same quiz that day (10 seconds a question), so the
        leaderboard stays fair. If the day is taken, your quiz moves to the next free day.
      </p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Questions{" "}
          <span className={cn("ml-1", picked.length >= 5 ? "text-emerald-600" : "text-amber-600")}>
            {picked.length} chosen
          </span>
          <span className="ml-1 text-xs font-normal text-neutral-500">
            (5–15, single choice or true/false)
          </span>
        </p>
        <div className="relative w-64">
          <Search
            size={14}
            aria-hidden="true"
            className="absolute left-2.5 top-2.5 text-neutral-400"
          />
          <Input
            aria-label="Search questions"
            className="h-9 pl-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions"
          />
        </div>
      </div>
      <ul className="mt-2 max-h-72 divide-y divide-neutral-200 overflow-y-auto rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {pool.map((q) => (
          <li key={q.id}>
            <label
              htmlFor={`pool-${q.id}`}
              aria-label={q.text}
              className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-white/[0.03]"
            >
              <input
                id={`pool-${q.id}`}
                type="checkbox"
                className="mt-1"
                checked={picked.includes(q.id)}
                onChange={() => toggle(q.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2">{q.text}</span>
                <span className="text-xs text-neutral-500">
                  {q.topic ?? "No topic"} · {q.difficulty.toLowerCase()}
                </span>
              </span>
            </label>
          </li>
        ))}
        {pool.length === 0 ? (
          <li className="px-3 py-4 text-sm text-neutral-500">No matching questions.</li>
        ) : null}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">
        Need new questions? Add them in Assessment → Questions, or upload them from Excel on a quiz
        page. Duplicates are flagged.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy || picked.length < 5 || !title.trim()} onClick={() => void save()}>
          {busy ? "Saving…" : existing ? "Save changes" : "Put on the calendar"}
        </Button>
      </div>
    </Modal>
  );
}

function DailyQuizContent() {
  const api = useDeskApi();
  const studentApi = useStudentAdminApi();
  const { toast, node } = useToast();
  const [courses, setCourses] = React.useState<{ id: string; title: string }[] | null>(null);
  const [courseId, setCourseId] = React.useState("");
  const [start, setStart] = React.useState(() => mondayOf(todayIso()));
  const [cal, setCal] = React.useState<DailyCalendarView | null>(null);
  const [error, setError] = React.useState(false);
  const [plan, setPlan] = React.useState<{
    date: string;
    existing: DailyScheduleItem | null;
  } | null>(null);

  React.useEffect(() => {
    studentApi
      .cohorts()
      .then((b) => {
        const list = [
          ...new Map(b.filter((x) => x.course).map((x) => [x.course!.id, x.course!])).values(),
        ];
        setCourses(list);
        setCourseId((c) => c || list[0]?.id || "");
      })
      .catch(() => setCourses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = React.useCallback(() => {
    if (!courseId) return;
    setError(false);
    api
      .calendar(courseId, start, addDaysIso(start, 20))
      .then(setCal)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, start]);
  React.useEffect(() => load(), [load]);

  const today = todayIso();
  const weeks = cal ? [0, 1, 2].map((w) => cal.days.slice(w * 7, w * 7 + 7)) : [];
  const planned = cal?.days.filter((d) => d.schedule && d.date >= today).length ?? 0;
  const empty = cal?.days.filter((d) => !d.schedule && d.date >= today).length ?? 0;

  return (
    <main className="flex flex-col gap-6">
      {node}
      <PageHeader
        title="Daily quiz calendar"
        subtitle="One quiz per course per day, the same for every student. Empty days are filled from the question bank."
      />
      <Card density="compact" className="flex flex-wrap items-center gap-3">
        {courses && courses.length > 1 ? (
          <select
            aria-label="Course"
            className={selectCls}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-medium">{courses?.[0]?.title ?? ""}</span>
        )}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Earlier"
            onClick={() => setStart((s) => addDaysIso(s, -7))}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <span className="min-w-[11rem] text-center text-sm">
            {dayLabel(start)} – {dayLabel(addDaysIso(start, 20))}
          </span>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Later"
            onClick={() => setStart((s) => addDaysIso(s, 7))}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
        <div className="ml-auto flex gap-2">
          <Pill tone="emerald">{planned} planned</Pill>
          <Pill tone="amber">{empty} empty</Pill>
        </div>
      </Card>

      {error ? (
        <RetryInline message="Couldn't load the calendar" onRetry={load} />
      ) : !cal ? (
        <Card className="text-sm text-neutral-500">
          {courses && courses.length === 0 ? "You have no course batches." : "Loading…"}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="hidden grid-cols-7 gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 md:grid">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <ul key={wi} className="grid gap-2 md:grid-cols-7">
              {week.map((d, i) => {
                const past = d.date < today;
                const s = d.schedule;
                const canEdit = !!s && s.mine && !past && d.played === 0;
                const tone = s ? (s.mine ? "indigo" : "violet") : past ? "slate" : "amber";
                return (
                  <li key={d.date}>
                    <ToneCard
                      tone={tone}
                      index={wi * 7 + i}
                      className={cn(
                        "flex h-full min-h-[7.5rem] flex-col p-3",
                        d.date === today && "ring-2 ring-primary-400",
                      )}
                    >
                      <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                        {d.date === today ? "Today" : dayLabel(d.date)}
                      </p>
                      {s ? (
                        <>
                          <p className="mt-1 line-clamp-2 text-sm font-medium text-neutral-900 dark:text-white">
                            {s.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-neutral-500">
                            {s.questionIds.length} questions · {s.mine ? "you" : s.createdBy.name}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                          <Shuffle size={12} aria-hidden="true" />{" "}
                          {past ? "Question bank" : "Bank picks"}
                        </p>
                      )}
                      <div className="mt-auto pt-2">
                        {d.played ? (
                          <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                            <Users size={11} aria-hidden="true" /> {d.played} played
                          </span>
                        ) : null}
                        {!past && !s ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setPlan({ date: d.date, existing: null })}
                          >
                            <Plus size={12} aria-hidden="true" /> Plan
                          </Button>
                        ) : canEdit ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setPlan({ date: d.date, existing: s })}
                          >
                            Change
                          </Button>
                        ) : s && !past && !s.mine ? (
                          <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                            <Lock size={11} aria-hidden="true" /> Another mentor&rsquo;s
                          </span>
                        ) : null}
                      </div>
                    </ToneCard>
                  </li>
                );
              })}
            </ul>
          ))}
          <p className="flex items-center gap-1.5 text-xs text-neutral-500">
            <CalendarDays size={13} aria-hidden="true" /> Indigo = yours · violet = another
            mentor&rsquo;s · amber = empty (the bank picks 10 questions). Class quizzes for one
            batch live in Assessment → Quizzes and don&rsquo;t count for streaks.
          </p>
        </div>
      )}

      {plan && courseId ? (
        <PlanDialog
          courseId={courseId}
          date={plan.date}
          existing={plan.existing}
          onClose={() => setPlan(null)}
          onSaved={(item) => {
            setPlan(null);
            toast(
              item.movedFrom
                ? `That day was taken, so it moved to ${dayLabel(item.date)}. You can change it.`
                : `Planned for ${dayLabel(item.date)}`,
              item.movedFrom ? "info" : "ok",
            );
            load();
          }}
        />
      ) : null}
    </main>
  );
}

export default function DailyQuizPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <DailyQuizContent />
    </RequirePermission>
  );
}
