"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Lock } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { useLessonData } from "@/components/lesson-viewer/use-lesson-data";
import { useLessonKeyboardShortcuts } from "@/components/lesson-viewer/use-lesson-keyboard-shortcuts";
import { LessonBreadcrumb } from "@/components/lesson-viewer/lesson-breadcrumb";
import { StickyProgressBar } from "@/components/lesson-viewer/sticky-progress-bar";
import { LessonContent } from "@/components/lesson-viewer/lesson-content";
import { LessonNavButtons } from "@/components/lesson-viewer/lesson-nav-buttons";
import { LessonCompleteBar } from "@/components/lesson-viewer/lesson-complete-bar";
import {
  CollapsedNavToggle,
  DesktopCourseNav,
  MobileCourseNavTrigger,
} from "@/components/lesson-viewer/course-nav-sidebar";
import { LessonViewerSkeleton } from "@/components/lesson-viewer/skeletons";

function LessonViewerContent() {
  const { id: courseId, lessonId } = useParams<{ id: string; lessonId: string }>();
  const {
    access,
    lesson,
    curriculum,
    courseProgress,
    location,
    previousLesson,
    nextLesson,
    completing,
    markComplete,
  } = useLessonData(courseId, lessonId);
  const [navCollapsed, setNavCollapsed] = React.useState(false);

  useLessonKeyboardShortcuts(courseId, previousLesson, nextLesson);

  if (access === "not-found") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={Lock}
          heading="Lesson not available"
          body="This lesson doesn't exist, isn't published, or has been removed."
          actionLabel="Back to course"
          actionHref={`/courses/${courseId}`}
        />
      </main>
    );
  }

  if (access === "locked") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={Lock}
          heading="This lesson is locked"
          body="You need to enroll in this course to access its lessons."
          actionLabel="Go to course"
          actionHref={`/courses/${courseId}`}
        />
      </main>
    );
  }

  if (access === "checking" || !lesson || !curriculum) {
    return <LessonViewerSkeleton />;
  }

  const moduleTotal = location?.moduleLessonIds.length ?? 0;
  const moduleCompleted = location?.moduleCompletedCount ?? 0;
  const modulePercent = moduleTotal > 0 ? Math.round((moduleCompleted / moduleTotal) * 100) : 0;

  return (
    <div className="flex flex-col">
      <StickyProgressBar percent={courseProgress?.percentComplete ?? 0} />

      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <LessonBreadcrumb course={curriculum} location={location} lessonTitle={lesson.title} />
          <div className="flex shrink-0 items-center gap-1.5">
            <MobileCourseNavTrigger
              courseId={courseId}
              curriculum={curriculum}
              currentLessonId={lessonId}
            />
            {navCollapsed ? <CollapsedNavToggle onExpand={() => setNavCollapsed(false)} /> : null}
            <LessonNavButtons
              variant="compact"
              courseId={courseId}
              previousLesson={previousLesson}
              nextLesson={nextLesson}
            />
          </div>
        </div>

        <div className="flex items-start gap-8">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
              {lesson.title}
            </h1>

            {location ? (
              <div className="mt-3 max-w-xs">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>{location.moduleTitle}</span>
                  <span className="tabular-nums">
                    {moduleCompleted}/{moduleTotal}
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-primary-600"
                    style={{ width: `${modulePercent}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-8">
              <LessonContent lesson={lesson} />
            </div>

            <div className="mt-10 border-t border-neutral-100 pt-6">
              <LessonCompleteBar
                courseId={courseId}
                completed={lesson.completed}
                completing={completing}
                nextLesson={nextLesson}
                onMarkComplete={() => void markComplete()}
              />
            </div>

            <div className="mt-8">
              <LessonNavButtons
                variant="full"
                courseId={courseId}
                previousLesson={previousLesson}
                nextLesson={nextLesson}
              />
            </div>

            <p className="mt-6 hidden text-xs text-neutral-400 sm:block">
              Use <kbd className="rounded border border-neutral-200 px-1 py-0.5">←</kbd>{" "}
              <kbd className="rounded border border-neutral-200 px-1 py-0.5">→</kbd> to navigate
              between lessons
            </p>
          </div>

          <DesktopCourseNav
            courseId={courseId}
            curriculum={curriculum}
            currentLessonId={lessonId}
            collapsed={navCollapsed}
            onToggleCollapse={() => setNavCollapsed(true)}
          />
        </div>
      </div>
    </div>
  );
}

export default function LessonViewerPage() {
  return (
    <RequireAuth>
      <LessonViewerContent />
    </RequireAuth>
  );
}
