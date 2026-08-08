import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { RecommendationType } from "@examora/types";
import { IconBadge } from "@/components/ui/icon-badge";
import { ScoreBadge } from "./score-badge";
import { AI_ICON, RECOMMENDATION_TYPE_META } from "./types";

/**
 * Fixed-width rail tile for non-course recommendations (quiz/assignment/
 * discussion) — same w-64 tile width as CourseCard so every section reads
 * as one consistent horizontally-scrolling rail, Netflix/Spotify-style.
 */
export function RecommendationCard({
  href,
  icon,
  title,
  subtitle,
  reason,
  score,
  type,
  actionLabel,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  reason: string;
  score: number;
  type: RecommendationType;
  actionLabel: string;
}) {
  const typeMeta = RECOMMENDATION_TYPE_META[type];

  return (
    <Link
      href={href}
      className="group block w-64 shrink-0 rounded-card border border-neutral-900/[0.06] bg-white p-4 shadow-soft transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-soft-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-start justify-between gap-2">
        <IconBadge icon={icon} tone="primary" />
        <ScoreBadge score={score} />
      </div>

      <h3 className="mt-3 line-clamp-2 font-heading text-base font-semibold text-neutral-900">
        {title}
      </h3>
      {subtitle ? <p className="mt-0.5 truncate text-sm text-neutral-500">{subtitle}</p> : null}

      <p className="mt-2.5 flex items-start gap-1.5 text-xs text-neutral-500">
        <AI_ICON
          size={13}
          strokeWidth={1.75}
          className="mt-0.5 shrink-0 text-accent-500"
          aria-hidden="true"
        />
        <span className="line-clamp-2">{reason}</span>
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
        <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          <typeMeta.icon size={11} strokeWidth={2} aria-hidden="true" />
          {typeMeta.label}
        </span>
        <span className="text-xs font-medium text-primary-600 group-hover:underline">
          {actionLabel} →
        </span>
      </div>
    </Link>
  );
}
