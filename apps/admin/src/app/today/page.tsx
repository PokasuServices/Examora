"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Brush,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileText,
  HelpCircle,
  MapPin,
  Megaphone,
  PartyPopper,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import type { MentorTodayView } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { RetryInline } from "@/components/ui/retry-inline";
import {
  Meter,
  Pill,
  SectionTitle,
  StatTile,
  ToneCard,
  ToneIcon,
  dayLabel,
  percentTone,
} from "@/components/desk-ui";
import { useDeskApi } from "@/lib/desk-api";

function greeting(): string {
  const h = new Date(Date.now() + 330 * 60_000).getUTCHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function TodayContent() {
  const api = useDeskApi();
  const [data, setData] = React.useState<MentorTodayView | null>(null);
  const [error, setError] = React.useState(false);
  const load = React.useCallback(() => {
    setError(false);
    api
      .today()
      .then(setData)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => load(), [load]);

  if (error) return <RetryInline message="Couldn't load your day" onRetry={load} />;
  if (!data) {
    return (
      <main className="flex flex-col gap-4">
        <div className="h-24 animate-pulse rounded-card bg-neutral-100 dark:bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-card bg-neutral-100 dark:bg-white/5"
            />
          ))}
        </div>
      </main>
    );
  }

  const reviews = data.reviews.sketches + data.reviews.revisions + data.reviews.assignments;
  const gapDays = data.quizGaps.reduce((n, g) => n + g.emptyDays.length, 0);
  const first = data.mentorName.split(" ")[0];

  return (
    <main className="flex flex-col gap-8">
      <ToneCard tone="indigo" className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-indigo-700 dark:text-indigo-300">{dayLabel(data.date)}</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold text-neutral-900 dark:text-white">
              {greeting()}, {first}
            </h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              {data.classes.length
                ? `You have ${data.classes.length} ${data.classes.length === 1 ? "class" : "classes"} today.`
                : "No classes today."}{" "}
              {reviews
                ? `${reviews} pieces of work are waiting for your marks.`
                : "Nothing waiting to be marked."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/announcements">
              <Button variant="secondary" size="sm">
                <Megaphone size={14} aria-hidden="true" /> Message a batch
              </Button>
            </Link>
            <Link href="/shoutouts">
              <Button variant="secondary" size="sm">
                <Sparkles size={14} aria-hidden="true" /> Give a shout-out ({data.shoutoutsLeft}{" "}
                left)
              </Button>
            </Link>
          </div>
        </div>
      </ToneCard>

      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          index={0}
          tone="cyan"
          icon={CalendarCheck}
          label="Attendance to mark"
          value={data.unmarked.length}
          hint={data.unmarked.length ? "Classes from the last 7 days" : "All caught up"}
          href="/attendance"
        />
        <StatTile
          index={1}
          tone="violet"
          icon={Brush}
          label="Work to review"
          value={reviews}
          hint={
            data.reviews.oldestHours !== null && reviews
              ? `Oldest waiting ${data.reviews.oldestHours < 48 ? `${data.reviews.oldestHours} h` : `${Math.round(data.reviews.oldestHours / 24)} days`}`
              : `${data.reviews.sketches + data.reviews.revisions} sketches · ${data.reviews.assignments} assignments`
          }
          href="/reviews"
        />
        <StatTile
          index={2}
          tone="amber"
          icon={HelpCircle}
          label="Open doubts"
          value={data.doubts.open}
          hint={data.doubts.newToday ? `${data.doubts.newToday} new today` : "From your courses"}
          href="/doubts"
        />
        <StatTile
          index={3}
          tone="emerald"
          icon={CalendarDays}
          label="Daily quiz gaps"
          value={gapDays}
          hint={gapDays ? "Empty days in the next week" : "Next 7 days are planned"}
          href="/daily-quiz"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <section>
            <SectionTitle>Today&rsquo;s classes</SectionTitle>
            {data.classes.length === 0 ? (
              <Card className="flex items-center gap-3 text-sm text-neutral-500">
                <PartyPopper size={18} aria-hidden="true" /> No classes on your timetable today.
              </Card>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.classes.map((c, i) => (
                  <li key={c.sessionId}>
                    <ToneCard tone={c.taken ? "emerald" : "cyan"} index={i} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-neutral-900 dark:text-white">
                            {c.cohortName}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-300">
                            <Clock size={13} aria-hidden="true" /> {c.start}–{c.end}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-neutral-500">
                            {c.mode === "ONLINE" ? (
                              <Video size={12} aria-hidden="true" />
                            ) : (
                              <MapPin size={12} aria-hidden="true" />
                            )}
                            {c.mode === "ONLINE"
                              ? c.meetingUrl
                                ? "Online class"
                                : "Online"
                              : (c.location ?? "Classroom")}
                          </p>
                        </div>
                        {c.taken ? (
                          <Pill tone="emerald">
                            {c.present}/{c.total} present
                          </Pill>
                        ) : (
                          <Pill tone="cyan">{c.total} students</Pill>
                        )}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Link href={`/attendance?session=${c.sessionId}`}>
                          <Button size="sm" variant={c.taken ? "ghost" : "primary"}>
                            <ClipboardCheck size={14} aria-hidden="true" />{" "}
                            {c.taken ? "Edit attendance" : "Mark attendance"}
                          </Button>
                        </Link>
                        {c.meetingUrl ? (
                          <a href={c.meetingUrl} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost">
                              <Video size={14} aria-hidden="true" /> Join
                            </Button>
                          </a>
                        ) : null}
                      </div>
                    </ToneCard>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.unmarked.length ? (
            <section>
              <SectionTitle>Attendance not marked yet</SectionTitle>
              <ul className="flex flex-wrap gap-2">
                {data.unmarked.map((u) => (
                  <li key={u.sessionId}>
                    <Link
                      href={`/attendance?session=${u.sessionId}`}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                      <CalendarCheck size={13} aria-hidden="true" /> {u.cohortName} ·{" "}
                      {dayLabel(u.date)} {u.start}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <SectionTitle
              action={
                <Link
                  href="/students"
                  className="text-xs font-medium text-primary-600 hover:underline"
                >
                  All students
                </Link>
              }
            >
              Students who need attention
            </SectionTitle>
            {data.atRisk.length === 0 ? (
              <Card className="text-sm text-neutral-500">Everyone is on track this month.</Card>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.atRisk.map((s, i) => (
                  <li key={s.userId}>
                    <ToneCard tone="rose" index={i} className="p-4">
                      <div className="flex items-start gap-3">
                        <ToneIcon tone="rose" icon={AlertTriangle} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/students/${s.userId}`}
                            className="font-medium text-neutral-900 hover:underline dark:text-white"
                          >
                            {s.name}
                          </Link>
                          <p className="text-xs text-neutral-500">{s.cohortName}</p>
                          <ul className="mt-2 flex flex-wrap gap-1">
                            {s.reasons.map((r) => (
                              <li key={r}>
                                <Pill tone="rose">{r}</Pill>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-3 flex gap-2">
                            <Link href={`/student-reports?new=ALERT&student=${s.userId}`}>
                              <Button size="sm" variant="ghost">
                                <FileText size={14} aria-hidden="true" /> Alert the admin
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </ToneCard>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section>
            <SectionTitle>My batches</SectionTitle>
            <ul className="flex flex-col gap-3">
              {data.batches.map((b, i) => (
                <li key={b.id}>
                  <ToneCard tone={percentTone(b.percent)} index={i} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/cohorts?batch=${b.id}`}
                        className="font-medium text-neutral-900 hover:underline dark:text-white"
                      >
                        {b.name}
                      </Link>
                      {b.role === "COVER" ? (
                        <Pill tone="amber">
                          Cover until {b.coverEndsOn ? dayLabel(b.coverEndsOn) : "—"}
                        </Pill>
                      ) : null}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                      <Users size={12} aria-hidden="true" /> {b.students} students
                      {b.courseTitle ? ` · ${b.courseTitle}` : ""}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Meter
                        value={b.percent}
                        tone={percentTone(b.percent)}
                        label="Attendance, last 30 days"
                      />
                      <span
                        className={cn(
                          "w-12 text-right text-xs font-semibold",
                          "text-neutral-700 dark:text-neutral-200",
                        )}
                      >
                        {b.percent === null ? "—" : `${b.percent}%`}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500">Attendance, last 30 days</p>
                  </ToneCard>
                </li>
              ))}
            </ul>
          </section>

          {data.quizGaps.length ? (
            <section>
              <SectionTitle>Daily quiz calendar</SectionTitle>
              <ToneCard tone="emerald" className="p-4">
                {data.quizGaps.map((g) => (
                  <div key={g.courseId} className="text-sm">
                    <p className="font-medium text-neutral-800 dark:text-neutral-100">
                      {g.courseTitle}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Empty: {g.emptyDays.slice(0, 4).map(dayLabel).join(", ")}
                      {g.emptyDays.length > 4 ? ` +${g.emptyDays.length - 4} more` : ""}. The
                      question bank fills empty days.
                    </p>
                  </div>
                ))}
                <Link
                  href="/daily-quiz"
                  className="mt-3 inline-block text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  Plan quizzes →
                </Link>
              </ToneCard>
            </section>
          ) : null}

          {data.returned.reports || data.returned.requests ? (
            <section>
              <SectionTitle>Sent back by the admin</SectionTitle>
              <ToneCard tone="amber" className="p-4 text-sm">
                {data.returned.reports ? (
                  <Link href="/student-reports?status=RETURNED" className="block hover:underline">
                    {data.returned.reports} report{data.returned.reports > 1 ? "s" : ""} to revise
                  </Link>
                ) : null}
                {data.returned.requests ? (
                  <Link href="/approvals" className="mt-1 block hover:underline">
                    {data.returned.requests} request{data.returned.requests > 1 ? "s" : ""} declined
                  </Link>
                ) : null}
              </ToneCard>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

export default function TodayPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <TodayContent />
    </RequirePermission>
  );
}
