import Link from "next/link";
import { cn } from "@examora/ui";
import { BookOpen, Clock, Layers } from "lucide-react";
import type { Course, CourseProgress, Curriculum } from "@examora/types";
import { Chip } from "@/components/ui/chip";
import { courseCoverWash } from "@/components/courses/course-cover";
import { formatMoney } from "@/lib/commerce-api";
import { formatDuration, totalDurationMinutes } from "./curriculum-stats";
import type { AccessState } from "./types";
import type { CourseCta } from "./course-cta";

/**
 * Instructor is omitted — Course has no mentor/instructor relation anywhere
 * in the schema (mentors attach to students, not courses). Duration/lesson
 * count only render when access === "granted": the curriculum endpoint
 * 403s the *entire* tree pre-purchase (all-or-nothing, no title-only
 * preview mode exists server-side), so there is nothing real to show for a
 * locked course beyond title/description/price.
 */
export function CourseHero({
  course,
  curriculum,
  progress,
  access,
  cta,
  onCtaClick,
}: {
  course: Course;
  curriculum: Curriculum | null;
  progress: CourseProgress | null;
  access: AccessState;
  cta: CourseCta;
  onCtaClick: () => void;
}) {
  const isFree = course.priceAmount === null;
  const duration = curriculum ? formatDuration(totalDurationMinutes(curriculum)) : null;

  return (
    <section className="overflow-hidden rounded-card border border-neutral-900/[0.06] bg-white shadow-soft">
      <div
        className={cn("h-40 w-full bg-gradient-to-br sm:h-52", courseCoverWash(course.title))}
        aria-hidden="true"
      />

      <div className="flex flex-col gap-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-1.5">
          {course.examType ? <Chip tone="neutral">{course.examType}</Chip> : null}
          <Chip tone={isFree ? "success" : "neutral"}>
            {isFree ? "Free" : formatMoney(course.priceAmount!, course.priceCurrency)}
          </Chip>
        </div>

        <div>
          <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {course.title}
          </h1>
          {course.description ? (
            <p className="mt-2 max-w-2xl text-sm text-neutral-600 sm:text-base">
              {course.description}
            </p>
          ) : null}
        </div>

        {curriculum ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <Layers size={16} strokeWidth={1.75} aria-hidden="true" />
              {curriculum.subjects.length}{" "}
              {curriculum.subjects.length === 1 ? "subject" : "subjects"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BookOpen size={16} strokeWidth={1.75} aria-hidden="true" />
              {curriculum.totalLessons} {curriculum.totalLessons === 1 ? "lesson" : "lessons"}
            </span>
            {duration ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
                {duration}
              </span>
            ) : null}
          </div>
        ) : null}

        {access === "granted" && progress ? (
          <div className="max-w-md">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-neutral-700">Your progress</span>
              <span className="tabular-nums text-neutral-500">
                {progress.completedLessons} of {progress.totalLessons} lessons ·{" "}
                {progress.percentComplete}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-primary-600"
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>
          </div>
        ) : null}

        <div>
          {cta.action === "continue" && progress?.nextLesson ? (
            <Link
              href={`/courses/${course.id}/lessons/${progress.nextLesson.id}`}
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary-600 px-6 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {cta.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onCtaClick}
              disabled={cta.disabled}
              className={cn(
                "inline-flex h-11 items-center justify-center rounded-md px-6 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60",
                cta.action === "none" && access === "granted"
                  ? "bg-success-50 text-success-700"
                  : "bg-primary-600 text-white hover:bg-primary-700",
              )}
            >
              {cta.label}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
