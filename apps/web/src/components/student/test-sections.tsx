"use client";

import * as React from "react";
import type { PracticeTestSection, QuestionType } from "@examora/types";
import { cn } from "@examora/ui";

const TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Single answer (MCQ)",
  MULTIPLE_CHOICE: "More than one answer (MSQ)",
  TRUE_FALSE: "True / false",
  NUMERIC: "Type a number (NAT)",
  UPLOAD: "Sketch upload",
};

/** "2 hours", "1 h 30 min", "45 min" */
export function sectionTime(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} ${h === 1 ? "hour" : "hours"}`;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

/** A practice test's sections as tabs: instructions plus a marking-scheme table each. */
export function TestSections({ sections }: { sections: PracticeTestSection[] }) {
  const [active, setActive] = React.useState(0);
  const section = sections[Math.min(active, sections.length - 1)]!;
  const tabsId = React.useId();
  const multiple = sections.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {multiple ? (
        <div
          role="tablist"
          aria-label="Test sections"
          className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800"
        >
          {sections.map((s, i) => (
            <button
              key={s.id ?? `implicit-${i}`}
              id={`${tabsId}-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-controls={`${tabsId}-panel`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                const next =
                  e.key === "ArrowRight"
                    ? (i + 1) % sections.length
                    : e.key === "ArrowLeft"
                      ? (i - 1 + sections.length) % sections.length
                      : null;
                if (next === null) return;
                setActive(next);
                document.getElementById(`${tabsId}-tab-${next}`)?.focus();
              }}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                i === active
                  ? "border-primary-600 text-primary-700 dark:text-primary-300"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400",
              )}
            >
              {s.title}
              {s.timeLimitMinutes ? (
                <span className="ml-1.5 text-xs font-normal text-neutral-400">
                  {sectionTime(s.timeLimitMinutes)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Marking scheme</h2>
      )}

      <div
        id={`${tabsId}-panel`}
        role={multiple ? "tabpanel" : undefined}
        aria-labelledby={multiple ? `${tabsId}-tab-${active}` : undefined}
        className="flex flex-col gap-3"
      >
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {section.questionCount} {section.questionCount === 1 ? "question" : "questions"} ·{" "}
          {fmt(section.totalMarks)} marks
          {section.timeLimitMinutes ? (
            <>
              {" "}
              · <strong className="font-medium">{sectionTime(section.timeLimitMinutes)}</strong> for
              this section
            </>
          ) : null}
        </p>
        {section.description ? (
          <p className="whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">
            {section.description}
          </p>
        ) : null}
        {section.marking.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
            <table className="w-full min-w-[520px] text-left text-sm">
              <caption className="sr-only">Marking scheme for {section.title}</caption>
              <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-white/[0.03] dark:text-neutral-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Question type
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Questions
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Correct
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Wrong
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Not answered
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {section.marking.map((r, i) => (
                  <tr key={`${r.type}-${i}`}>
                    <th
                      scope="row"
                      className="px-3 py-2 font-normal text-neutral-700 dark:text-neutral-300"
                    >
                      {TYPE_LABEL[r.type]}
                      {r.partialMarking ? (
                        <span className="block text-xs text-neutral-500">
                          Part marks for some correct options
                        </span>
                      ) : null}
                      {r.type === "UPLOAD" ? (
                        <span className="block text-xs text-neutral-500">Marked by a reviewer</span>
                      ) : null}
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums">{r.questionCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-success-700 dark:text-success-400">
                      +{fmt(r.marksEach)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-danger-700 dark:text-danger-400">
                      {r.negativeEach > 0 ? `−${fmt(r.negativeEach)}` : "0"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">0</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmt(r.marksEach * r.questionCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
