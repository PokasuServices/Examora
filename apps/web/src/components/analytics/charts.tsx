"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Design-token hexes (Tailwind indigo/emerald/amber/red/cyan/slate) — kept as
// literal values since recharts renders to SVG outside Tailwind's reach.
export const CHART_COLORS = {
  primary: "#4f46e5",
  success: "#059669",
  warning: "#d97706",
  danger: "#dc2626",
  accent: "#0891b2",
  grid: "#e2e8f0",
  axis: "#94a3b8",
} as const;

const AXIS_STYLE = { fontSize: 11, fill: CHART_COLORS.axis };

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-neutral-400">
      {message}
    </div>
  );
}

/** Smooth filled area trend — the primary "over time" chart across every Analytics screen. */
export function TrendAreaChart({
  data,
  xKey,
  series,
  valueFormatter,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
  valueFormatter?: (value: number) => string;
}) {
  if (data.length === 0) return <EmptyChart message="No data in this range yet." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          formatter={(value) =>
            valueFormatter && typeof value === "number" ? valueFormatter(value) : value
          }
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            fontSize: 12,
            boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
          }}
        />
        {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#fill-${s.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Two-line comparison trend (e.g. quiz vs. assignment averages over time). */
export function TrendLineChart({
  data,
  xKey,
  series,
  valueFormatter,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
  valueFormatter?: (value: number) => string;
}) {
  if (data.length === 0) return <EmptyChart message="No data in this range yet." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          formatter={(value) =>
            valueFormatter && typeof value === "number" ? valueFormatter(value) : value
          }
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            fontSize: 12,
            boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Categorical bar comparison (e.g. per-course completion, per-mentor caseload). */
export function CategoryBarChart({
  data,
  nameKey,
  valueKey,
  color = CHART_COLORS.primary,
  valueFormatter,
  domain,
}: {
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
  color?: string;
  valueFormatter?: (value: number) => string;
  domain?: [number, number];
}) {
  if (data.length === 0) return <EmptyChart message="Nothing to show yet." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey={nameKey}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis domain={domain} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          formatter={(value) =>
            valueFormatter && typeof value === "number" ? valueFormatter(value) : value
          }
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            fontSize: 12,
            boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
          }}
        />
        <Bar dataKey={valueKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Clean proportional bar list (role/channel/decision breakdowns) — Stripe-style, no pie clutter. */
export function BreakdownBars({
  items,
  color = CHART_COLORS.primary,
}: {
  items: { label: string; value: number }[];
  color?: string;
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  if (items.length === 0 || total === 0) {
    return <p className="text-sm text-neutral-400">No data yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <li key={item.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-neutral-700">{item.label}</span>
              <span className="tabular-nums text-neutral-500">
                {item.value.toLocaleString()} · {pct}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
