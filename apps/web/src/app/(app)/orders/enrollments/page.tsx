"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { OrdersShell } from "@/components/orders/orders-shell";
import { useEnrollments, type EnrolledCourse } from "@/components/orders/use-enrollments";
import { enrollmentStatusTone, statusLabel } from "@/components/orders/format";
import { courseCoverWash } from "@/components/courses/course-cover";

function EnrollmentRow({ course }: { course: EnrolledCourse }) {
  const continueHref = course.nextLessonId
    ? `/courses/${course.courseId}/lessons/${course.nextLessonId}`
    : `/courses/${course.courseId}`;

  return (
    <li className="flex flex-col gap-3 rounded-md border border-neutral-100 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "h-12 w-12 shrink-0 rounded-md bg-gradient-to-br",
            courseCoverWash(course.courseTitle),
          )}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-800">{course.courseTitle}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Enrolled{" "}
            {new Date(course.enrolledAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 sm:shrink-0">
        {typeof course.completionPercent === "number" ? (
          <div className="hidden w-28 items-center gap-2 sm:flex">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-primary-600"
                style={{ width: `${course.completionPercent}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums text-neutral-500">
              {course.completionPercent}%
            </span>
          </div>
        ) : null}
        <Chip tone={enrollmentStatusTone(course.status)}>{statusLabel(course.status)}</Chip>
        {course.status === "ACTIVE" ? (
          <Link
            href={continueHref}
            className="shrink-0 text-sm font-medium text-primary-600 hover:underline"
          >
            Continue →
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function EnrollmentsContent() {
  const { status, courses, retry } = useEnrollments();

  if (status === "loading") {
    return (
      <Card>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card>
        <RetryInline message="Couldn't load your enrollments" onRetry={retry} />
      </Card>
    );
  }

  if (courses.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={GraduationCap}
          heading="No enrollments yet"
          body="Once you enroll in a course — free or paid — it'll show up here."
          actionLabel="Browse courses"
          actionHref="/courses"
        />
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-heading text-lg font-semibold text-neutral-900">Your courses</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {courses.map((course) => (
          <EnrollmentRow key={course.id} course={course} />
        ))}
      </ul>
    </Card>
  );
}

export default function EnrollmentsPage() {
  return (
    <RequireAuth>
      <OrdersShell>
        <EnrollmentsContent />
      </OrdersShell>
    </RequireAuth>
  );
}
