import Link from "next/link";
import { BookOpen, ClipboardList, HelpCircle, Layers } from "lucide-react";
import type { Course, CourseProgress, Curriculum } from "@examora/types";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/commerce-api";
import { formatDuration, totalDurationMinutes } from "./curriculum-stats";
import type { AccessState, SubjectStats } from "./types";
import type { CourseCta } from "./course-cta";

function sumStats(subjectStats: Map<string, SubjectStats>) {
  let quizzes = 0;
  let assignments = 0;
  for (const s of subjectStats.values()) {
    quizzes += s.quizCount;
    assignments += s.assignmentCount;
  }
  return { quizzes, assignments };
}

/**
 * The sticky purchase/progress widget. For a locked (paid, unpurchased)
 * course this is the *only* place lesson-level trust signals could appear —
 * and even here they can't, because the curriculum endpoint 403s the whole
 * tree pre-purchase. So a locked course's "includes" list is just price;
 * an owned course's list is the real computed lesson/subject/quiz/
 * assignment counts.
 */
export function SidebarSummary({
  course,
  curriculum,
  progress,
  access,
  cta,
  purchaseError,
  subjectStats,
  onCtaClick,
}: {
  course: Course;
  curriculum: Curriculum | null;
  progress: CourseProgress | null;
  access: AccessState;
  cta: CourseCta;
  purchaseError: string | null;
  subjectStats: Map<string, SubjectStats> | null;
  onCtaClick: () => void;
}) {
  const isFree = course.priceAmount === null;
  const duration = curriculum ? formatDuration(totalDurationMinutes(curriculum)) : null;
  const totals = subjectStats ? sumStats(subjectStats) : null;

  return (
    <Card className="lg:sticky lg:top-20">
      <p className="font-heading text-3xl font-bold text-neutral-900">
        {isFree ? "Free" : formatMoney(course.priceAmount!, course.priceCurrency)}
      </p>

      {cta.action === "continue" && progress?.nextLesson ? (
        <Link
          href={`/courses/${course.id}/lessons/${progress.nextLesson.id}`}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {cta.label}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onCtaClick}
          disabled={cta.disabled}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
        >
          {cta.label}
        </button>
      )}

      {purchaseError ? <p className="mt-3 text-sm text-error-600">{purchaseError}</p> : null}

      {access === "locked" ? (
        <p className="mt-3 text-xs text-neutral-500">
          Already purchased?{" "}
          <Link href="/orders" className="text-primary-600 hover:underline">
            Check your order history
          </Link>
          .
        </p>
      ) : null}

      {curriculum ? (
        <div className="mt-6 border-t border-neutral-100 pt-5">
          <p className="text-sm font-medium text-neutral-800">This course includes</p>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm text-neutral-600">
            <li className="flex items-center gap-2.5">
              <Layers
                size={16}
                strokeWidth={1.75}
                className="shrink-0 text-neutral-400"
                aria-hidden="true"
              />
              {curriculum.subjects.length}{" "}
              {curriculum.subjects.length === 1 ? "subject" : "subjects"}
            </li>
            <li className="flex items-center gap-2.5">
              <BookOpen
                size={16}
                strokeWidth={1.75}
                className="shrink-0 text-neutral-400"
                aria-hidden="true"
              />
              {curriculum.totalLessons} {curriculum.totalLessons === 1 ? "lesson" : "lessons"}
              {duration ? ` (${duration})` : ""}
            </li>
            {totals && totals.quizzes > 0 ? (
              <li className="flex items-center gap-2.5">
                <HelpCircle
                  size={16}
                  strokeWidth={1.75}
                  className="shrink-0 text-neutral-400"
                  aria-hidden="true"
                />
                {totals.quizzes} {totals.quizzes === 1 ? "quiz" : "quizzes"}
              </li>
            ) : null}
            {totals && totals.assignments > 0 ? (
              <li className="flex items-center gap-2.5">
                <ClipboardList
                  size={16}
                  strokeWidth={1.75}
                  className="shrink-0 text-neutral-400"
                  aria-hidden="true"
                />
                {totals.assignments} {totals.assignments === 1 ? "assignment" : "assignments"}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
