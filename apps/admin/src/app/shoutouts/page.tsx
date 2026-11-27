"use client";

import * as React from "react";
import {
  Brush,
  CalendarCheck,
  Flame,
  Lightbulb,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import {
  SHOUTOUT_BADGES,
  SHOUTOUTS_PER_WEEK,
  type ShoutoutBadge,
  type ShoutoutView,
} from "@examora/types";
import { Button, Label, cn } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pill, ToneCard, ToneIcon, timeAgo, useToast, type Tone } from "@/components/desk-ui";
import { useDeskApi } from "@/lib/desk-api";
import { useStudentAdminApi } from "@/lib/student-admin-api";

export const BADGE_ICON: Record<string, LucideIcon> = {
  brush: Brush,
  "trending-up": TrendingUp,
  "message-circle": MessageCircle,
  "calendar-check": CalendarCheck,
  trophy: Trophy,
  lightbulb: Lightbulb,
  flame: Flame,
};
const BADGE_TONE: Tone[] = ["violet", "emerald", "cyan", "indigo", "amber", "rose", "amber"];

function ShoutoutsContent() {
  const api = useDeskApi();
  const studentApi = useStudentAdminApi();
  const { toast, toastError, node } = useToast();
  const [data, setData] = React.useState<{ given: ShoutoutView[]; left: number } | null>(null);
  const [students, setStudents] = React.useState<{ userId: string; name: string; batch: string }[]>(
    [],
  );
  const [studentId, setStudentId] = React.useState("");
  const [badge, setBadge] = React.useState<ShoutoutBadge>("best-sketch");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .shoutouts()
      .then(setData)
      .catch(() => setData({ given: [], left: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    load();
    void (async () => {
      const batches = await studentApi.cohorts();
      const all: { userId: string; name: string; batch: string }[] = [];
      for (const b of batches) {
        for (const m of await studentApi.cohortMembers(b.id)) {
          if (!all.some((a) => a.userId === m.userId))
            all.push({ userId: m.userId, name: m.name, batch: b.name });
        }
      }
      setStudents(all.sort((a, b) => a.name.localeCompare(b.name)));
    })().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function give() {
    setBusy(true);
    try {
      await api.giveShoutout({ studentId, badge, note: note || undefined });
      toast("Shout-out sent 🎉 It shows in the student's Rewards.");
      setNote("");
      setStudentId("");
      load();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-col gap-6">
      {node}
      <PageHeader
        title="Shout-outs"
        subtitle={`Celebrate effort with a badge. It appears in the student's Rewards with your note. ${SHOUTOUTS_PER_WEEK} a week, so each one stays special.`}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ToneCard tone="violet" className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">Give a shout-out</h2>
            <Pill tone={data && data.left > 0 ? "emerald" : "rose"}>
              {data ? `${data.left} left this week` : "…"}
            </Pill>
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="so-student">Student</Label>
            <select
              id="so-student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="">Choose a student…</option>
              {students.map((s) => (
                <option key={s.userId} value={s.userId}>
                  {s.name} · {s.batch}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Badge</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {SHOUTOUT_BADGES.map((b, i) => {
                const Icon = BADGE_ICON[b.icon] ?? Sparkles;
                const on = badge === b.key;
                return (
                  <label
                    key={b.key}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition",
                      on
                        ? "border-violet-400 bg-violet-50 dark:border-violet-400/60 dark:bg-violet-500/15"
                        : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900",
                    )}
                  >
                    <input
                      type="radio"
                      name="badge"
                      className="sr-only"
                      checked={on}
                      onChange={() => setBadge(b.key)}
                    />
                    <ToneIcon tone={BADGE_TONE[i % BADGE_TONE.length]!} icon={Icon} size="sm" />
                    {b.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="so-note">A line from you (optional)</Label>
            <input
              id="so-note"
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Your perspective room was the best in the batch!"
              className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              disabled={busy || !studentId || (data?.left ?? 0) === 0}
              onClick={() => void give()}
            >
              <Sparkles size={14} aria-hidden="true" /> Send shout-out
            </Button>
          </div>
        </ToneCard>
        <section>
          <h2 className="mb-3 font-heading text-base font-semibold">Recently given</h2>
          {!data ? (
            <Card className="text-sm text-neutral-500">Loading…</Card>
          ) : data.given.length === 0 ? (
            <Card>
              <EmptyState icon={Sparkles} heading="No shout-outs yet" />
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.given.map((s, i) => {
                const Icon = BADGE_ICON[s.icon] ?? Sparkles;
                const idx = SHOUTOUT_BADGES.findIndex((b) => b.key === s.badge);
                const tone = BADGE_TONE[(idx < 0 ? 0 : idx) % BADGE_TONE.length]!;
                return (
                  <li key={s.id}>
                    <ToneCard tone={tone} index={i} className="p-3">
                      <div className="flex items-start gap-3">
                        <ToneIcon tone={tone} icon={Icon} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{s.student.name}</p>
                          <p className="text-xs text-neutral-600 dark:text-neutral-300">
                            {s.label}
                          </p>
                          {s.note ? (
                            <p className="mt-1 text-xs italic text-neutral-500">“{s.note}”</p>
                          ) : null}
                          <p className="mt-1 text-[11px] text-neutral-400">
                            {timeAgo(s.createdAt)}
                          </p>
                        </div>
                      </div>
                    </ToneCard>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default function ShoutoutsPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <ShoutoutsContent />
    </RequirePermission>
  );
}
