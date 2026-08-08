"use client";

import Link from "next/link";
import {
  ClipboardList,
  HelpCircle,
  MessageSquare,
  Milestone,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { CourseCard } from "@/components/dashboard/course-card";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { RecommendationSection } from "@/components/recommendations/recommendation-section";
import { useRecommendationsHome } from "@/components/recommendations/use-recommendations-home";

function RecommendationsContent() {
  const data = useRecommendationsHome();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-card bg-gradient-to-br from-primary-600 to-accent-600 p-8 text-white shadow-soft sm:p-10">
        <div className="flex items-center gap-2 text-primary-100">
          <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            AI-powered, just for you
          </span>
        </div>
        <h1 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">Recommended for you</h1>
        <p className="mt-2 max-w-xl text-sm text-primary-50 sm:text-base">
          Personalized suggestions based on your enrollments, progress, and activity — every
          suggestion below tells you exactly why it&rsquo;s here.
        </p>
      </div>

      <RecommendationSection
        icon={PlayCircle}
        title="Continue Learning"
        status={data.status}
        isEmpty={data.continueLearning.length === 0}
        emptyHeading="Nothing in progress right now"
        emptyBody="Once you start a lesson, it'll show up here so you can pick up where you left off."
        emptyActionLabel="Browse courses"
        emptyActionHref="/courses"
        onRetry={data.retry}
      >
        {data.continueLearning.map((item) => (
          <CourseCard
            key={item.courseId}
            href={
              item.nextLesson
                ? `/courses/${item.courseId}/lessons/${item.nextLesson.id}`
                : `/courses/${item.courseId}`
            }
            title={item.courseTitle}
            subtitle={
              item.nextLesson
                ? `Next: ${item.nextLesson.title}`
                : `${item.completionPercent}% complete`
            }
            progressPercent={item.completionPercent}
            reason={item.reason}
          />
        ))}
      </RecommendationSection>

      <RecommendationSection
        icon={Sparkles}
        title="Recommended Courses"
        status={data.status}
        isEmpty={data.courses.length === 0}
        emptyHeading="Nothing to recommend yet"
        emptyBody="Complete a lesson or two and we'll start suggesting what's next."
        emptyActionLabel="Browse courses"
        emptyActionHref="/courses"
        onRetry={data.retry}
      >
        {data.courses.map((rec) => (
          <CourseCard
            key={rec.courseId}
            href={`/courses/${rec.courseId}`}
            title={rec.courseTitle}
            subtitle={rec.categoryName ?? undefined}
            reason={rec.reason}
          />
        ))}
      </RecommendationSection>

      <RecommendationSection
        icon={HelpCircle}
        title="Recommended Quizzes"
        status={data.status}
        isEmpty={data.quizzes.length === 0}
        emptyHeading="No quiz recommendations yet"
        emptyBody="Enroll in a course to get quiz suggestions matched to what you're studying."
        emptyActionLabel="Browse courses"
        emptyActionHref="/courses"
        onRetry={data.retry}
        skeletonVariant="generic"
      >
        {data.quizzes.map((item) => (
          <RecommendationCard
            key={item.quizId}
            href={`/quizzes/${item.quizId}`}
            icon={HelpCircle}
            title={item.quizTitle}
            subtitle={item.subjectTitle ?? undefined}
            reason={item.reason}
            score={item.score}
            type="QUIZ"
            actionLabel="Start quiz"
          />
        ))}
      </RecommendationSection>

      <RecommendationSection
        icon={ClipboardList}
        title="Recommended Assignments"
        status={data.status}
        isEmpty={data.assignments.length === 0}
        emptyHeading="No assignment recommendations yet"
        emptyBody="Enroll in a course to get assignment suggestions matched to what you're studying."
        emptyActionLabel="Browse courses"
        emptyActionHref="/courses"
        onRetry={data.retry}
        skeletonVariant="generic"
      >
        {data.assignments.map((item) => (
          <RecommendationCard
            key={item.assignmentId}
            href={`/assignments/${item.assignmentId}`}
            icon={ClipboardList}
            title={item.assignmentTitle}
            subtitle={item.subjectTitle ?? undefined}
            reason={item.reason}
            score={item.score}
            type="ASSIGNMENT"
            actionLabel="View assignment"
          />
        ))}
      </RecommendationSection>

      <RecommendationSection
        icon={Milestone}
        title="Learning Path"
        status={data.status}
        isEmpty={data.learningPath.length === 0}
        emptyHeading="Keep progressing to unlock a suggested path"
        emptyBody="Once you've made some headway in a course, we'll suggest what to take next."
        emptyActionLabel="Browse courses"
        emptyActionHref="/courses"
        onRetry={data.retry}
        action={
          <Link
            href="/recommendations/learning-path"
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            View full path →
          </Link>
        }
      >
        {data.learningPath.map((step) => (
          <CourseCard
            key={step.courseId}
            href={`/courses/${step.courseId}`}
            title={`${step.order}. ${step.courseTitle}`}
            reason={step.reason}
          />
        ))}
      </RecommendationSection>

      <RecommendationSection
        icon={Sparkles}
        title="Similar Courses"
        status={data.status}
        isEmpty={data.similarCourses.length === 0}
        emptyHeading="No similar courses to show yet"
        emptyBody="Enroll in a course and we'll surface others like it."
        emptyActionLabel="Browse courses"
        emptyActionHref="/courses"
        onRetry={data.retry}
      >
        {data.similarCourses.map((item) => (
          <CourseCard
            key={item.courseId}
            href={`/courses/${item.courseId}`}
            title={item.courseTitle}
            subtitle={`Because you're taking ${item.referenceCourseTitle}`}
            reason={item.reason}
          />
        ))}
      </RecommendationSection>

      <RecommendationSection
        icon={MessageSquare}
        title="Community Discussions"
        status={data.status}
        isEmpty={data.discussions.length === 0}
        emptyHeading="No related discussions yet"
        emptyBody="As the community discusses your courses, relevant threads will show up here."
        emptyActionLabel="Browse Community"
        emptyActionHref="/community"
        onRetry={data.retry}
        skeletonVariant="generic"
      >
        {data.discussions.map((item) => (
          <RecommendationCard
            key={item.threadId}
            href={`/community/threads/${item.threadId}`}
            icon={MessageSquare}
            title={item.threadTitle}
            reason={item.reason}
            score={item.score}
            type="COMMUNITY_DISCUSSION"
            actionLabel="Open discussion"
          />
        ))}
      </RecommendationSection>
    </main>
  );
}

export default function RecommendationsPage() {
  return (
    <RequireAuth>
      <RecommendationsContent />
    </RequireAuth>
  );
}
