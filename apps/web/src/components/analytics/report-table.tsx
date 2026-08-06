import type { ReportResult } from "@examora/types";

function formatCell(value: string | number | boolean | null): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  // ISO-timestamp-shaped strings render as local date/time; anything else prints as-is.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  }
  return value;
}

/** Generic tabular renderer for any ReportResult — the same {columns, rows} shape every report type returns. */
export function ReportTable({ result }: { result: ReportResult }) {
  if (result.rows.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-400">This report has no rows.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-900/[0.06]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-neutral-50">
          <tr>
            {result.columns.map((col) => (
              <th
                key={col}
                className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {result.rows.map((row, i) => (
            <tr key={i} className="hover:bg-neutral-50">
              {result.columns.map((col) => (
                <td key={col} className="whitespace-nowrap px-4 py-2.5 text-neutral-700">
                  {formatCell(row[col] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
