"use client";

import * as React from "react";
import { Users } from "lucide-react";
import type { MentorMeeting } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

/** History + a log-meeting form. No "Upcoming Meetings" — MentorMeeting only ever records what already happened. */
export function MeetingsSection({
  meetings,
  onCreate,
}: {
  meetings: MentorMeeting[];
  onCreate: (input: {
    occurredAt: string;
    durationMinutes?: number;
    summary?: string;
  }) => Promise<void>;
}) {
  const [occurredAt, setOccurredAt] = React.useState(() => new Date().toISOString().slice(0, 16));
  const [duration, setDuration] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onCreate({
        occurredAt: new Date(occurredAt).toISOString(),
        durationMinutes: duration ? Number(duration) : undefined,
        summary: summary.trim() || undefined,
      });
      setSummary("");
      setDuration("");
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...meetings].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <section aria-labelledby="meetings-heading">
      <h2 id="meetings-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Meetings
      </h2>
      <Card className="mt-3">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label
                htmlFor="meeting-when"
                className="mb-1 block text-xs font-medium text-neutral-500"
              >
                Date &amp; time
              </label>
              <input
                id="meeting-when"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              />
            </div>
            <div>
              <label
                htmlFor="meeting-duration"
                className="mb-1 block text-xs font-medium text-neutral-500"
              >
                Duration (minutes, optional)
              </label>
              <input
                id="meeting-duration"
                type="number"
                min={1}
                max={480}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              />
            </div>
          </div>
          <label htmlFor="meeting-summary" className="sr-only">
            Meeting summary
          </label>
          <textarea
            id="meeting-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What did you discuss? (optional)"
            className="min-h-16 w-full rounded-md border border-neutral-200 p-3 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
          <button
            type="submit"
            disabled={saving}
            className="flex h-9 w-fit items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
          >
            {saving ? "Logging…" : "Log meeting"}
          </button>
        </form>

        <div className="mt-4 border-t border-neutral-100 pt-4">
          {sorted.length === 0 ? (
            <EmptyState icon={Users} heading="No meetings logged yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-100">
              {sorted.map((m) => (
                <li key={m.id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-neutral-800">
                      {new Date(m.occurredAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {m.durationMinutes ? (
                      <span className="shrink-0 text-xs text-neutral-400">
                        {m.durationMinutes} min
                      </span>
                    ) : null}
                  </div>
                  {m.summary ? <p className="mt-1 text-neutral-600">{m.summary}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </section>
  );
}
