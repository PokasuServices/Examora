"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LearningDashboard } from "@examora/types";
import { Button } from "@examora/ui";
import { useLearningApi } from "@/lib/learning-api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpcomingAssignments } from "./use-upcoming-assignments";

type HeroPick =
  | {
      kind: "assignment";
      eyebrow: string;
      eyebrowTone: "warning" | "danger";
      title: string;
      context: string;
      href: string;
      ctaLabel: string;
    }
  | {
      kind: "lesson";
      eyebrow: string;
      title: string;
      context: string;
      href: string;
      ctaLabel: string;
      percentComplete: number;
    }
  | { kind: "empty" }
  | { kind: "fallback" };

function pickHeroContent(
  assignments: ReturnType<typeof useUpcomingAssignments>,
  dashboard: LearningDashboard | null,
  dashboardFailed: boolean,
): HeroPick | null {
  if (assignments.status === "loading" || (!dashboard && !dashboardFailed)) return null;

  // 1. Anything due within 24h (or overdue) is the single most urgent thing on the page.
  if (assignments.status === "ready") {
    const urgent = assignments.data.find((a) => {
      const hours = (new Date(a.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
      return hours < 24;
    });
    if (urgent) {
      const hours = (new Date(urgent.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
      return {
        kind: "assignment",
        eyebrow: hours < 0 ? "Overdue" : `Due in ${Math.max(1, Math.round(hours))}h`,
        eyebrowTone: hours < 0 ? "danger" : "warning",
        title: urgent.title,
        context: `${urgent.marksTotal} marks`,
        href: `/assignments/${urgent.id}`,
        ctaLabel: "View assignment",
      };
    }
  }

  // 2. Otherwise, resume the most recently active in-progress course.
  if (dashboard && dashboard.continueLearning.length > 0) {
    const course = dashboard.continueLearning[0]!;
    return {
      kind: "lesson",
      eyebrow: "Continue where you left off",
      title: course.nextLesson?.title ?? course.courseTitle,
      context: course.courseTitle,
      href: course.nextLesson
        ? `/courses/${course.courseId}/lessons/${course.nextLesson.id}`
        : `/courses/${course.courseId}`,
      ctaLabel: "Resume lesson",
      percentComplete: course.percentComplete,
    };
  }

  // 3. Genuinely new student — nothing in progress, nothing due.
  if (
    dashboard &&
    dashboard.continueLearning.length === 0 &&
    dashboard.stats.coursesStarted === 0
  ) {
    return { kind: "empty" };
  }

  return { kind: "fallback" };
}

export function HeroSection() {
  const learningApi = useLearningApi();
  const [dashboard, setDashboard] = React.useState<LearningDashboard | null>(null);
  const [dashboardFailed, setDashboardFailed] = React.useState(false);
  const assignments = useUpcomingAssignments();

  React.useEffect(() => {
    learningApi
      .getDashboard()
      .then(setDashboard)
      .catch(() => setDashboardFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = pickHeroContent(assignments, dashboard, dashboardFailed);

  if (!pick) {
    return (
      <Card className="flex items-center justify-between gap-6">
        <div className="flex-1">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-3 h-8 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/3" />
        </div>
        <Skeleton className="h-12 w-40 shrink-0 rounded-md" />
      </Card>
    );
  }

  if (pick.kind === "empty") {
    return (
      <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Let&apos;s get started
          </p>
          <h1 className="mt-1 font-heading text-[32px] font-bold leading-tight text-neutral-900">
            Browse courses in Fashion Design, Architecture &amp; more
          </h1>
        </div>
        <Link href="/courses" className="w-full shrink-0 sm:w-auto">
          <Button variant="primary" size="lg" className="w-full sm:w-auto">
            Explore courses <ArrowRight size={18} className="ml-1.5" aria-hidden="true" />
          </Button>
        </Link>
      </Card>
    );
  }

  if (pick.kind === "fallback") {
    return (
      <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-bold text-neutral-900">
          Jump back into your courses
        </h1>
        <Link href="/courses" className="w-full shrink-0 sm:w-auto">
          <Button variant="secondary" size="lg" className="w-full sm:w-auto">
            My courses
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p
          className={
            pick.kind === "assignment"
              ? `text-xs font-semibold uppercase tracking-wide ${pick.eyebrowTone === "danger" ? "text-danger-600" : "text-warning-600"}`
              : "text-xs font-semibold uppercase tracking-wide text-neutral-500"
          }
        >
          {pick.eyebrow}
        </p>
        <h1 className="mt-1 truncate font-heading text-[32px] font-bold leading-tight text-neutral-900">
          {pick.title}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
          {pick.context}
          {pick.kind === "lesson" ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-primary-600"
                  style={{ width: `${pick.percentComplete}%` }}
                />
              </span>
              {pick.percentComplete}%
            </span>
          ) : null}
        </p>
      </div>
      <Link href={pick.href} className="w-full shrink-0 sm:w-auto">
        <Button variant="primary" size="lg" className="w-full sm:w-auto">
          {pick.ctaLabel} <ArrowRight size={18} className="ml-1.5" aria-hidden="true" />
        </Button>
      </Link>
    </Card>
  );
}
