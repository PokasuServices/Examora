"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown, TrendingUp } from "lucide-react";
import { cn } from "@examora/ui";
import { useLoad } from "@/components/student/use-load";
import { METHOD_LABEL, useStudentApi } from "@/lib/student-api";

/** Fixed categorical colours for answer methods (same as the profile chart). */
const METHOD_FILL = { KNOWLEDGE: "#2563eb", ELIMINATION: "#f59e0b", GUESS: "#f43f5e" } as const;
const METHODS = ["KNOWLEDGE", "ELIMINATION", "GUESS"] as const;

/** Loads the first-attempt scores for a course (optionally one practice category). */
function usePerformance(courseId: string, categoryId?: string) {
  const api = useStudentApi();
  const load = useLoad(
    () => api.performance(courseId, categoryId),
    `${courseId}-${categoryId ?? "all"}`,
  );
  const rows = (load.data ?? []).map((p) => ({
    name: p.quizTitle,
    ...p.byMethod,
    total: p.percent,
  }));
  return { ...load, rows };
}

function PerformanceBody({
  perf,
  emptyText = "Finish a test in this tab to see your scores here, split by how you answered.",
}: {
  perf: ReturnType<typeof usePerformance>;
  emptyText?: string;
}) {
  const [asTable, setAsTable] = React.useState(false);
  const rows = perf.rows;
  return (
    <>
      {perf.loading && !perf.data ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{emptyText}</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-neutral-500">
              First attempt at each test: % of marks, by how you got the answers.
            </p>
            <button
              type="button"
              onClick={() => setAsTable((t) => !t)}
              className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              {asTable ? "Show chart" : "Show as table"}
            </button>
          </div>
          {asTable ? (
            <table className="mt-2 w-full text-sm">
              <caption className="sr-only">Test scores by answer method</caption>
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th scope="col" className="py-1 font-medium">
                    Test
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Score
                  </th>
                  {METHODS.map((m) => (
                    <th key={m} scope="col" className="py-1 text-right font-medium">
                      {METHOD_LABEL[m]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {rows.map((d) => (
                  <tr key={d.name}>
                    <th scope="row" className="py-1.5 text-left font-normal">
                      {d.name}
                    </th>
                    <td className="py-1.5 text-right tabular-nums">{d.total}%</td>
                    {METHODS.map((m) => (
                      <td key={m} className="py-1.5 text-right tabular-nums">
                        {d[m]}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              className="mt-2 h-56 w-full text-neutral-500"
              role="img"
              aria-label={rows.map((d) => `${d.name}: ${d.total}%`).join("; ")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.15} />
                  <XAxis dataKey="name" tick={{ fill: "currentColor", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "currentColor", fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(v) => `${String(v)}%`}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {METHODS.map((m) => (
                    <Bar
                      key={m}
                      dataKey={m}
                      name={METHOD_LABEL[m]}
                      stackId="score"
                      fill={METHOD_FILL[m]}
                      stroke="#fff"
                      strokeWidth={1}
                      maxBarSize={44}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </>
  );
}

/** Chart (or table) of first-attempt scores without the Practice tab's collapsible header. */
export function PerformanceView({
  courseId,
  categoryId,
  emptyText,
}: {
  courseId: string;
  categoryId?: string;
  emptyText?: string;
}) {
  const perf = usePerformance(courseId, categoryId);
  return <PerformanceBody perf={perf} emptyText={emptyText} />;
}

/**
 * "My test performance" for one Practice tab: the first attempt at each test
 * in the category, % of marks split by how the answers were reached.
 */
export function TestPerformanceChart({
  courseId,
  categoryId,
  categoryTitle,
}: {
  courseId: string;
  categoryId: string;
  categoryTitle: string;
}) {
  const [open, setOpen] = React.useState(true);
  const perf = usePerformance(courseId, categoryId);
  const rows = perf.rows;
  const panelId = React.useId();

  return (
    <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded text-left text-sm font-medium text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-white/90"
      >
        <TrendingUp size={16} aria-hidden="true" className="text-primary-600" />
        My performance in {categoryTitle}
        {rows.length > 0 ? (
          <span className="text-xs font-normal text-neutral-500">
            · {rows.length} {rows.length === 1 ? "test" : "tests"} taken
          </span>
        ) : null}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn("ml-auto text-neutral-400 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div id={panelId} className="mt-3">
          <PerformanceBody perf={perf} />
        </div>
      ) : null}
    </div>
  );
}
