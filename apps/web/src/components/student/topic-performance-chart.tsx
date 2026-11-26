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
import type { TopicInsight } from "@examora/types";
import { METHOD_LABEL } from "@/lib/student-api";

/** Same fixed method colours as the test performance chart. */
const METHOD_FILL = { KNOWLEDGE: "#2563eb", ELIMINATION: "#f59e0b", GUESS: "#f43f5e" } as const;
const METHODS = ["KNOWLEDGE", "ELIMINATION", "GUESS"] as const;

const pct = (n: number, of: number) => (of === 0 ? 0 : Math.round((n / of) * 100));

/**
 * Topic performance in one attempt: for each topic, the share of its questions
 * answered correctly, split by how the answer was reached.
 */
export function TopicPerformanceChart({ topics }: { topics: TopicInsight[] }) {
  const [asTable, setAsTable] = React.useState(false);
  const rows = topics
    .map((t) => ({
      name: t.topicTitle,
      total: t.total,
      KNOWLEDGE: pct(t.byMethod.KNOWLEDGE.correct, t.total),
      ELIMINATION: pct(t.byMethod.ELIMINATION.correct, t.total),
      GUESS: pct(t.byMethod.GUESS.correct, t.total),
      all: pct(
        t.byMethod.KNOWLEDGE.correct + t.byMethod.ELIMINATION.correct + t.byMethod.GUESS.correct,
        t.total,
      ),
    }))
    .sort((a, b) => b.all - a.all);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        The questions in this quiz aren&rsquo;t tagged with topics yet.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          % of each topic&rsquo;s questions you got right, by how you got there.
        </p>
        <button
          type="button"
          onClick={() => setAsTable((t) => !t)}
          className="shrink-0 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>
      {asTable ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <caption className="sr-only">Topic performance by answer method</caption>
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th scope="col" className="py-1 font-medium">
                  Topic
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Correct
                </th>
                {METHODS.map((m) => (
                  <th key={m} scope="col" className="py-1 text-right font-medium">
                    {METHOD_LABEL[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {rows.map((r) => (
                <tr key={r.name}>
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {r.name}
                    <span className="ml-1 text-xs text-neutral-500">({r.total} q)</span>
                  </th>
                  <td className="py-1.5 text-right tabular-nums">{r.all}%</td>
                  {METHODS.map((m) => (
                    <td key={m} className="py-1.5 text-right tabular-nums">
                      {r[m]}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="mt-2 w-full text-neutral-500"
          style={{ height: Math.max(160, rows.length * 40 + 70) }}
          role="img"
          aria-label={rows.map((r) => `${r.name}: ${r.all}% correct`).join("; ")}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
            >
              <CartesianGrid horizontal={false} stroke="currentColor" strokeOpacity={0.15} />
              <XAxis
                type="number"
                domain={[0, 100]}
                unit="%"
                tick={{ fill: "currentColor", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fill: "currentColor", fontSize: 11 }}
              />
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
                  stackId="topic"
                  fill={METHOD_FILL[m]}
                  stroke="#fff"
                  strokeWidth={1}
                  maxBarSize={22}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
