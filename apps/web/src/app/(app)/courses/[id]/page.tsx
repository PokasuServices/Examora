"use client";

import { useParams } from "next/navigation";
import { Lock } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { useCourseAccess } from "@/components/course-detail/use-course-access";
import { useCourseExtras } from "@/components/course-detail/use-course-extras";
import { getCourseCta } from "@/components/course-detail/course-cta";
import { CourseHero } from "@/components/course-detail/course-hero";
import { CurriculumAccordion } from "@/components/course-detail/curriculum-accordion";
import { ProgressTracker } from "@/components/course-detail/progress-tracker";
import { SidebarSummary } from "@/components/course-detail/sidebar-summary";
import { CourseRailSection } from "@/components/course-detail/course-rail-section";
import {
  CourseHeroSkeleton,
  CourseSidebarSkeleton,
  CurriculumSkeleton,
} from "@/components/course-detail/skeletons";

function CourseDetailContent() {
  const { id } = useParams<{ id: string }>();
  const {
    course,
    curriculum,
    progress,
    access,
    notFound,
    purchaseState,
    purchaseError,
    handleBuy,
  } = useCourseAccess(id);
  const { subjectStats, related, recommended } = useCourseExtras(id, curriculum);

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={Lock}
          heading="Course not available"
          body="This course doesn't exist, isn't published, or has been removed."
          actionLabel="Back to catalog"
          actionHref="/courses"
        />
      </main>
    );
  }

  if (!course) {
    return (
      <main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <CourseHeroSkeleton />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <CurriculumSkeleton />
          <CourseSidebarSkeleton />
        </div>
      </main>
    );
  }

  const cta = getCourseCta(access, progress, purchaseState);

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <CourseHero
        course={course}
        curriculum={curriculum}
        progress={progress}
        access={access}
        cta={cta}
        onCtaClick={handleBuy}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-10 lg:order-1">
          {access === "checking" ? (
            <CurriculumSkeleton />
          ) : access === "granted" && curriculum ? (
            <>
              <CurriculumAccordion
                courseId={id}
                curriculum={curriculum}
                subjectStats={subjectStats}
              />
              <ProgressTracker curriculum={curriculum} subjectStats={subjectStats} />
            </>
          ) : (
            <EmptyState
              icon={Lock}
              heading="Curriculum locked"
              body="The full curriculum, quizzes, and assignments unlock once you enroll — this course's content is only available to enrolled students."
            />
          )}

          <CourseRailSection
            title="Related courses"
            status={related.status}
            items={related.items.map((r) => ({
              courseId: r.courseId,
              courseTitle: r.courseTitle,
              reason: r.reason,
            }))}
          />
          <CourseRailSection
            title="Recommended for you"
            status={recommended.status}
            items={recommended.items.map((r) => ({
              courseId: r.courseId,
              courseTitle: r.courseTitle,
              reason: r.reason,
            }))}
          />
        </div>

        <div className="lg:order-2">
          {access === "checking" ? (
            <CourseSidebarSkeleton />
          ) : (
            <SidebarSummary
              course={course}
              curriculum={curriculum}
              progress={progress}
              access={access}
              cta={cta}
              purchaseError={purchaseError}
              subjectStats={subjectStats}
              onCtaClick={handleBuy}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default function CourseDetailPage() {
  return (
    <RequireAuth>
      <CourseDetailContent />
    </RequireAuth>
  );
}
