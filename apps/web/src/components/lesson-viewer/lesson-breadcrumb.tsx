import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Course } from "@examora/types";
import type { LessonLocation } from "./types";

export function LessonBreadcrumb({
  course,
  location,
  lessonTitle,
}: {
  course: Course;
  location: LessonLocation | null;
  lessonTitle: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 text-sm text-neutral-500"
    >
      <Link
        href={`/courses/${course.id}`}
        className="shrink-0 hover:text-neutral-700 hover:underline"
      >
        {course.title}
      </Link>
      {location ? (
        <>
          <ChevronRight
            size={14}
            strokeWidth={2}
            className="shrink-0 text-neutral-300"
            aria-hidden="true"
          />
          <span className="hidden shrink-0 sm:inline">{location.subjectTitle}</span>
          <ChevronRight
            size={14}
            strokeWidth={2}
            className="hidden shrink-0 text-neutral-300 sm:inline"
            aria-hidden="true"
          />
        </>
      ) : (
        <ChevronRight
          size={14}
          strokeWidth={2}
          className="shrink-0 text-neutral-300"
          aria-hidden="true"
        />
      )}
      <span className="truncate font-medium text-neutral-800" aria-current="page">
        {lessonTitle}
      </span>
    </nav>
  );
}
