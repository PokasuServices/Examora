import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@examora/ui";

function pageWindow(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i]!;
    if (i > 0 && page - sorted[i - 1]! > 1) result.push("ellipsis");
    result.push(page);
  }
  return result;
}

/** Numbered pagination with Prev/Next. Mirrors apps/web's Pagination exactly. */
export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {pageWindow(page, pageCount).map((entry, i) =>
        entry === "ellipsis" ? (
          <span key={`e${i}`} className="px-1 text-sm text-neutral-400" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              entry === page
                ? "bg-primary-600 text-white"
                : "text-neutral-600 hover:bg-neutral-100",
            )}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
        className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </nav>
  );
}
