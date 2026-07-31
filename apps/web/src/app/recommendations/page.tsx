"use client";

import * as React from "react";
import type {
  AssignmentRecommendation,
  ContinueLearningItem,
  CourseRecommendation,
  LearningPathStep,
  QuizRecommendation,
  RelatedDiscussionRecommendation,
  SimilarCourseRecommendation,
} from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { useRecommendationsApi } from "@/lib/recommendations-api";

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
      {score}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function RecommendationCard({
  title,
  subtitle,
  reason,
  score,
}: {
  title: string;
  subtitle?: string;
  reason: string;
  score: number;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div>
        <p className="font-medium text-neutral-900">{title}</p>
        {subtitle ? <p className="text-xs text-neutral-500">{subtitle}</p> : null}
        <p className="mt-1 text-sm text-neutral-600">{reason}</p>
      </div>
      <ScoreBadge score={score} />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-neutral-500">{label}</p>;
}

function RecommendationsContent() {
  const api = useRecommendationsApi();
  const [loading, setLoading] = React.useState(true);
  const [continueLearning, setContinueLearning] = React.useState<ContinueLearningItem[]>([]);
  const [courses, setCourses] = React.useState<CourseRecommendation[]>([]);
  const [similarCourses, setSimilarCourses] = React.useState<SimilarCourseRecommendation[]>([]);
  const [learningPath, setLearningPath] = React.useState<LearningPathStep[]>([]);
  const [quizzes, setQuizzes] = React.useState<QuizRecommendation[]>([]);
  const [assignments, setAssignments] = React.useState<AssignmentRecommendation[]>([]);
  const [discussions, setDiscussions] = React.useState<RelatedDiscussionRecommendation[]>([]);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getContinueLearning(),
      api.getRecommendedCourses(),
      api.getSimilarCourses(),
      api.getLearningPath(),
      api.getRecommendedQuizzes(),
      api.getRecommendedAssignments(),
      api.getRelatedDiscussions(),
    ])
      .then(([cl, c, sc, lp, q, a, d]) => {
        setContinueLearning(cl);
        setCourses(c);
        setSimilarCourses(sc);
        setLearningPath(lp);
        setQuizzes(q);
        setAssignments(a);
        setDiscussions(d);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-heading">Recommended for you</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Personalized suggestions based on your enrollments, progress, and activity.
      </p>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}

      {!loading ? (
        <>
          <Section title="Continue learning">
            {continueLearning.length === 0 ? (
              <EmptyState label="No courses in progress yet." />
            ) : (
              <div className="flex flex-col gap-3">
                {continueLearning.map((item) => (
                  <RecommendationCard
                    key={item.courseId}
                    title={item.courseTitle}
                    subtitle={
                      item.nextLesson
                        ? `Next: ${item.nextLesson.title}`
                        : `${item.completionPercent}% complete`
                    }
                    reason={item.reason}
                    score={item.score}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Recommended courses">
            {courses.length === 0 ? (
              <EmptyState label="Enroll in a course to get personalized course recommendations." />
            ) : (
              <div className="flex flex-col gap-3">
                {courses.map((item) => (
                  <RecommendationCard
                    key={item.courseId}
                    title={item.courseTitle}
                    subtitle={item.categoryName ?? undefined}
                    reason={item.reason}
                    score={item.score}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Similar courses">
            {similarCourses.length === 0 ? (
              <EmptyState label="No similar courses to show yet." />
            ) : (
              <div className="flex flex-col gap-3">
                {similarCourses.map((item) => (
                  <RecommendationCard
                    key={item.courseId}
                    title={item.courseTitle}
                    reason={item.reason}
                    score={item.score}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Suggested learning path">
            {learningPath.length === 0 ? (
              <EmptyState label="Keep progressing through a course to unlock a suggested path." />
            ) : (
              <ol className="flex flex-col gap-3">
                {learningPath.map((step) => (
                  <li key={step.courseId}>
                    <RecommendationCard
                      title={`${step.order}. ${step.courseTitle}`}
                      reason={step.reason}
                      score={step.score}
                    />
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Recommended quizzes">
            {quizzes.length === 0 ? (
              <EmptyState label="No quiz recommendations yet." />
            ) : (
              <div className="flex flex-col gap-3">
                {quizzes.map((item) => (
                  <RecommendationCard
                    key={item.quizId}
                    title={item.quizTitle}
                    subtitle={item.subjectTitle ?? undefined}
                    reason={item.reason}
                    score={item.score}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Recommended assignments">
            {assignments.length === 0 ? (
              <EmptyState label="No assignment recommendations yet." />
            ) : (
              <div className="flex flex-col gap-3">
                {assignments.map((item) => (
                  <RecommendationCard
                    key={item.assignmentId}
                    title={item.assignmentTitle}
                    subtitle={item.subjectTitle ?? undefined}
                    reason={item.reason}
                    score={item.score}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Related community discussions">
            {discussions.length === 0 ? (
              <EmptyState label="No related discussions yet." />
            ) : (
              <div className="flex flex-col gap-3">
                {discussions.map((item) => (
                  <RecommendationCard
                    key={item.threadId}
                    title={item.threadTitle}
                    reason={item.reason}
                    score={item.score}
                  />
                ))}
              </div>
            )}
          </Section>
        </>
      ) : null}
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
