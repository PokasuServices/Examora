import Link from "next/link";
import { cn } from "@examora/ui";
import { ReasonChip } from "@/components/ui/chip";

// No cover-image field exists on Course anywhere in the schema — a
// deterministic color wash per the design spec, not a stock photo.
const COVER_WASHES = [
  "from-primary-500 to-primary-700",
  "from-accent-400 to-accent-600",
  "from-success-400 to-success-600",
  "from-warning-400 to-warning-600",
  "from-purple-400 to-purple-600",
  "from-pink-400 to-pink-600",
];

function washFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COVER_WASHES[hash % COVER_WASHES.length]!;
}

export function CourseCard({
  href,
  title,
  subtitle,
  progressPercent,
  reason,
}: {
  href: string;
  title: string;
  subtitle?: string;
  progressPercent?: number;
  reason?: string;
}) {
  return (
    <Link
      href={href}
      className="group block w-64 shrink-0 rounded-card border border-neutral-900/[0.06] bg-white p-4 shadow-soft transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-soft-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div
        className={cn("h-24 w-full rounded-md bg-gradient-to-br", washFor(title))}
        aria-hidden="true"
      />
      <h3 className="mt-3 truncate font-heading text-base font-semibold text-neutral-900">
        {title}
      </h3>
      {subtitle ? <p className="mt-0.5 truncate text-sm text-neutral-500">{subtitle}</p> : null}

      {typeof progressPercent === "number" ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-primary-600"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums text-neutral-500">
            {progressPercent}%
          </span>
        </div>
      ) : null}

      {reason ? (
        <div className="mt-3">
          <ReasonChip reason={reason} />
        </div>
      ) : null}
    </Link>
  );
}
