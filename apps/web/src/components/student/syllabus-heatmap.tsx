"use client";

import * as React from "react";
import Link from "next/link";
import type { SyllabusHeatmap as Heatmap } from "@examora/types";
import { cn } from "@examora/ui";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { SegmentedControl } from "@/components/ui/segmented-control";

/** Sequential single-hue scale (Examora primary): light = few past-paper questions, dark = many. */
const STEPS = [
  "bg-primary-50 text-primary-900",
  "bg-primary-100 text-primary-900",
  "bg-primary-200 text-primary-900",
  "bg-primary-400 text-white",
  "bg-primary-600 text-white",
  "bg-primary-800 text-white",
];

function stepFor(count: number, max: number): string {
  if (max <= 0 || count <= 0) return STEPS[0]!;
  return STEPS[Math.min(STEPS.length - 1, Math.ceil((count / max) * (STEPS.length - 1)))]!;
}

/** Where past papers put their weight: questions per subject per year, per exam. */
export function SyllabusHeatmap({
  heatmaps,
  nextExamDate,
}: {
  heatmaps: Heatmap[];
  nextExamDate: string | null;
}) {
  const [exam, setExam] = React.useState(heatmaps[0]?.examLabel ?? "");
  const map = heatmaps.find((h) => h.examLabel === exam) ?? heatmaps[0];
  const max = map ? Math.max(0, ...map.rows.flatMap((r) => Object.values(r.counts))) : 0;
  const examMonth = nextExamDate
    ? new Date(nextExamDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">
            Past-paper weightage
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Questions per subject in previous years&rsquo; papers
          </p>
        </div>
        {examMonth ? <Chip tone="primary">Next exam: {examMonth}</Chip> : null}
      </div>

      {heatmaps.length > 1 ? (
        <div className="mt-4">
          <SegmentedControl
            aria-label="Exam"
            value={exam}
            onChange={setExam}
            options={heatmaps.map((h) => ({ value: h.examLabel, label: h.examLabel }))}
          />
        </div>
      ) : null}

      {!map || map.rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          No past-paper breakdown has been added for this course yet.
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] border-separate border-spacing-[2px] text-sm">
              <caption className="sr-only">
                Past-paper questions per subject and year, {map.examLabel}
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="px-2 py-1.5 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400"
                  >
                    Subject
                  </th>
                  {map.years.map((y) => (
                    <th
                      key={y}
                      scope="col"
                      className="px-2 py-1.5 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400"
                    >
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {map.rows.map((row) => (
                  <tr key={row.subjectId}>
                    <th
                      scope="row"
                      className="px-2 py-1.5 text-left font-normal text-neutral-700 dark:text-neutral-300"
                    >
                      {row.subjectTitle}
                    </th>
                    {map.years.map((y) => {
                      const count = row.counts[String(y)] ?? 0;
                      return (
                        <td
                          key={y}
                          title={`${row.subjectTitle}, ${y}: ${count} question${count === 1 ? "" : "s"}`}
                          className={cn(
                            "rounded px-2 py-1.5 text-center text-xs font-semibold tabular-nums",
                            stepFor(count, max),
                          )}
                        >
                          {count}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            Fewer
            <span className="flex gap-[2px]" aria-hidden="true">
              {STEPS.map((s) => (
                <span key={s} className={cn("h-2.5 w-5 rounded-sm", s.split(" ")[0])} />
              ))}
            </span>
            More questions
          </div>
        </>
      )}

      <Link
        href="/practice"
        className="mt-4 inline-flex text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
      >
        Practise past papers →
      </Link>
    </Card>
  );
}
