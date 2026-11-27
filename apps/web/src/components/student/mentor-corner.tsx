"use client";

import * as React from "react";
import {
  Brush,
  CalendarCheck,
  ExternalLink,
  Flame,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@examora/auth-client";
import type { BatchAnnouncementView, MyAttendanceView, ShoutoutView } from "@examora/types";
import { cn } from "@examora/ui";
import { ToneCard, ToneIcon, toneClasses, type Tone } from "@/components/ui/tone-card";

/** The mentor module's student-side bits: attendance, batch notices, shout-outs. */
function useMentorApi() {
  const { request } = useAuth();
  return {
    attendance: () => request<MyAttendanceView>("/me/attendance", { method: "GET" }),
    announcements: () => request<BatchAnnouncementView[]>("/me/announcements", { method: "GET" }),
    shoutouts: () => request<ShoutoutView[]>("/me/shoutouts", { method: "GET" }),
  };
}

function useOnce<T>(fn: () => Promise<T>): T | null {
  const [data, setData] = React.useState<T | null>(null);
  React.useEffect(() => {
    fn()
      .then(setData)
      .catch(() => setData(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
}

const AGO = (iso: string) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
};

function percentTone(p: number | null): Tone {
  if (p === null) return "slate";
  if (p >= 85) return "emerald";
  if (p >= 75) return "cyan";
  if (p >= 60) return "amber";
  return "rose";
}

/** Attendance % and the next class; hidden when the student isn't in a batch. */
export function AttendanceCard() {
  const api = useMentorApi();
  const a = useOnce(() => api.attendance());
  if (!a || a.batches.length === 0) return null;
  const tone = percentTone(a.percent);
  const t = toneClasses(tone);
  const next = a.batches.find((b) => b.nextClass)?.nextClass;
  return (
    <ToneCard tone={tone} className="p-5">
      <div className="flex items-start gap-3">
        <ToneIcon tone={tone} icon={CalendarCheck} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            My attendance
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
            {a.percent === null ? "—" : `${a.percent}%`}
          </p>
          <p className="text-xs text-neutral-500">
            {a.present + a.late} of {a.present + a.late + a.absent} classes
            {a.excused ? ` · ${a.excused} excused` : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
        <div
          className={cn("h-full origin-left rounded-full motion-safe:animate-grow-x", t.line)}
          style={{ width: `${a.percent ?? 0}%` }}
        />
      </div>
      {a.recent.length ? (
        <ul className="mt-3 flex gap-1" aria-label="Last classes">
          {a.recent
            .slice(0, 10)
            .reverse()
            .map((r) => (
              <li
                key={`${r.date}-${r.start}`}
                title={`${r.date} ${r.start}: ${r.status ?? "not marked"}`}
                className={cn(
                  "h-5 flex-1 rounded",
                  r.status === "PRESENT" && "bg-emerald-400/80",
                  r.status === "LATE" && "bg-amber-400/80",
                  r.status === "ABSENT" && "bg-rose-400/80",
                  r.status === "EXCUSED" && "bg-sky-400/80",
                  !r.status && "bg-neutral-200 dark:bg-white/10",
                )}
              />
            ))}
        </ul>
      ) : null}
      {next ? (
        <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-300">Next class: {next}</p>
      ) : null}
      {a.percent !== null && a.percent < 75 ? (
        <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
          Below 75%. Try not to miss the next few classes.
        </p>
      ) : null}
    </ToneCard>
  );
}

/** The latest notices from the student's batch mentors. */
export function BatchNotices() {
  const api = useMentorApi();
  const rows = useOnce(() => api.announcements());
  if (!rows || rows.length === 0) return null;
  return (
    <ToneCard tone="cyan" className="p-5">
      <div className="flex items-center gap-2">
        <ToneIcon tone="cyan" icon={Megaphone} size="sm" />
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-white/90">
          From your mentor
        </h2>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {rows.slice(0, 3).map((n) => (
          <li key={n.id}>
            <p className="text-sm font-medium text-neutral-900 dark:text-white">{n.title}</p>
            <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">{n.body}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
              {n.author.name} · {n.cohortName} · {AGO(n.createdAt)}
              {n.linkUrl ? (
                <a
                  href={n.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary-600 hover:underline"
                >
                  <ExternalLink size={10} aria-hidden="true" /> Open link
                </a>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </ToneCard>
  );
}

const ICONS: Record<string, LucideIcon> = {
  brush: Brush,
  "trending-up": TrendingUp,
  "message-circle": MessageCircle,
  "calendar-check": CalendarCheck,
  trophy: Trophy,
  lightbulb: Lightbulb,
  flame: Flame,
};
const TONES: Tone[] = ["violet", "emerald", "cyan", "indigo", "amber", "rose"];

/** Shout-out badges mentors gave this student (Rewards tab). */
export function MentorShoutouts() {
  const api = useMentorApi();
  const rows = useOnce(() => api.shoutouts());
  if (!rows || rows.length === 0) return null;
  return (
    <section aria-labelledby="shoutouts-heading">
      <h2
        id="shoutouts-heading"
        className="mb-3 flex items-center gap-2 text-base font-medium text-neutral-800 dark:text-white/90"
      >
        <Sparkles size={16} aria-hidden="true" className="text-violet-500" /> Shout-outs from your
        mentors
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s, i) => {
          const tone = TONES[i % TONES.length]!;
          return (
            <li key={s.id}>
              <ToneCard tone={tone} index={i} className="h-full p-4">
                <div className="flex items-start gap-3">
                  <ToneIcon tone={tone} icon={ICONS[s.icon] ?? Sparkles} />
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900 dark:text-white">{s.label}</p>
                    {s.note ? (
                      <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-200">
                        “{s.note}”
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-neutral-500">
                      {s.mentor.name} · {AGO(s.createdAt)}
                    </p>
                  </div>
                </div>
              </ToneCard>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
