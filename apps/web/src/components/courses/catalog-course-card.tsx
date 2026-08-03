import Link from "next/link";
import { cn } from "@examora/ui";
import { CheckCircle2 } from "lucide-react";
import { Chip, ReasonChip } from "@/components/ui/chip";
import { courseCoverWash } from "@/components/courses/course-cover";
import { formatMoney } from "@/lib/commerce-api";
import type { EnrichedCourse } from "./types";

function statusCta(entry: EnrichedCourse): { label: string; tone: "primary" | "neutral" } {
  switch (entry.status) {
    case "locked":
      return { label: "Purchase", tone: "primary" };
    case "in-progress":
      return { label: "Continue learning", tone: "primary" };
    case "completed":
      return { label: "Review course", tone: "neutral" };
    case "not-started":
    default:
      return {
        label: entry.course.priceAmount === null ? "Start for free" : "Start learning",
        tone: "primary",
      };
  }
}

/**
 * Catalog grid card. Deliberately omits Mentor Name, Duration, Lesson/Quiz/
 * Assignment counts, Student Rating, and Enrollment Count from the original
 * design spec — none of that data exists in the backend (verified against
 * the Course/Category/Enrollment models and every course-facing endpoint;
 * see the implementation report's Honest Deviations section). Purchase/
 * enroll actions are never duplicated here — every CTA routes to the course
 * detail page, which already owns the real checkout/free-enrollment flow.
 */
export function CatalogCourseCard({ entry }: { entry: EnrichedCourse }) {
  const { course } = entry;
  const cta = statusCta(entry);
  const isFree = course.priceAmount === null;

  return (
    <Link
      href={`/courses/${course.id}`}
      className="group flex flex-col rounded-card border border-neutral-900/[0.06] bg-white p-4 shadow-soft transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-soft-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div
        className={cn(
          "h-28 w-full shrink-0 rounded-md bg-gradient-to-br",
          courseCoverWash(course.title),
        )}
        aria-hidden="true"
      />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {course.examType ? <Chip tone="neutral">{course.examType}</Chip> : null}
        <Chip tone={isFree ? "success" : "neutral"}>
          {isFree ? "Free" : formatMoney(course.priceAmount!, course.priceCurrency)}
        </Chip>
        {entry.status === "completed" ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success-600">
            <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
            Completed
          </span>
        ) : null}
      </div>

      <h3 className="mt-2 line-clamp-2 font-heading text-base font-semibold leading-snug text-neutral-900">
        {course.title}
      </h3>
      {course.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{course.description}</p>
      ) : null}

      {entry.recommendedReason ? (
        <div className="mt-2">
          <ReasonChip reason={entry.recommendedReason} />
        </div>
      ) : null}

      <div className="flex-1" />

      {typeof entry.completionPercent === "number" && entry.status !== "locked" ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-primary-600"
              style={{ width: `${entry.completionPercent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums text-neutral-500">
            {entry.completionPercent}%
          </span>
        </div>
      ) : null}

      <span
        className={cn(
          "mt-3 inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
          cta.tone === "primary"
            ? "bg-primary-600 text-white group-hover:bg-primary-700"
            : "bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200",
        )}
      >
        {cta.label}
      </span>
    </Link>
  );
}
