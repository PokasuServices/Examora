import Link from "next/link";
import { CheckCircle2, Circle, FileText, Image as ImageIcon, PlayCircle } from "lucide-react";
import { cn } from "@examora/ui";
import type { Curriculum, LessonContentType } from "@examora/types";
import { Chip } from "@/components/ui/chip";
import type { SubjectStats } from "./types";

const CONTENT_ICON: Record<LessonContentType, typeof PlayCircle> = {
  VIDEO: PlayCircle,
  TEXT: FileText,
  ARTICLE: FileText,
  PDF: FileText,
  IMAGE: ImageIcon,
};

/**
 * Subject → Topic → Module → Lesson, using native <details>/<summary> for
 * the subject accordion — full keyboard + screen-reader support with no
 * custom JS. Quiz/Assignment indicator chips sit on the Subject header
 * because that's the only level they actually classify under in the schema.
 */
export function CurriculumAccordion({
  courseId,
  curriculum,
  subjectStats,
  currentLessonId,
  showHeading = true,
}: {
  courseId: string;
  curriculum: Curriculum;
  subjectStats: Map<string, SubjectStats> | null;
  /** Highlights the active lesson and auto-expands its subject — used when reused as the Lesson Viewer's course-navigation sidebar. */
  currentLessonId?: string;
  showHeading?: boolean;
}) {
  return (
    <section aria-labelledby={showHeading ? "curriculum-heading" : undefined}>
      {showHeading ? (
        <h2 id="curriculum-heading" className="font-heading text-xl font-semibold text-neutral-900">
          Curriculum
        </h2>
      ) : null}
      <div className={showHeading ? "mt-4 flex flex-col gap-3" : "flex flex-col gap-3"}>
        {curriculum.subjects.map((subject, index) => {
          const stats = subjectStats?.get(subject.id);
          const lessonCount = subject.topics
            .flatMap((t) => t.modules)
            .flatMap((m) => m.lessons).length;
          const containsCurrent = currentLessonId
            ? subject.topics
                .flatMap((t) => t.modules)
                .flatMap((m) => m.lessons)
                .some((l) => l.id === currentLessonId)
            : false;

          return (
            <details
              key={subject.id}
              open={currentLessonId ? containsCurrent : index === 0}
              className="group rounded-card border border-neutral-900/[0.06] bg-white shadow-soft [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                <div className="min-w-0">
                  <p className="truncate font-heading text-base font-semibold text-neutral-900">
                    {subject.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span>
                      {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
                    </span>
                    {stats && stats.quizCount > 0 ? (
                      <Chip tone="accent">
                        {stats.quizCount} {stats.quizCount === 1 ? "quiz" : "quizzes"}
                      </Chip>
                    ) : null}
                    {stats && stats.assignmentCount > 0 ? (
                      <Chip tone="warning">
                        {stats.assignmentCount}{" "}
                        {stats.assignmentCount === 1 ? "assignment" : "assignments"}
                      </Chip>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 text-neutral-400 transition-transform group-open:rotate-180">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </summary>

              <div className="border-t border-neutral-100 px-5 py-3">
                {subject.topics.map((topic) => (
                  <div key={topic.id} className="mt-3 first:mt-0">
                    <p className="text-sm font-medium text-neutral-700">{topic.title}</p>
                    {topic.modules.map((mod) => (
                      <div key={mod.id} className="mt-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                          {mod.title}
                        </p>
                        <ul className="mt-1 flex flex-col divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-100">
                          {mod.lessons.map((lesson) => {
                            const Icon = CONTENT_ICON[lesson.contentType];
                            const isCurrent = lesson.id === currentLessonId;
                            return (
                              <li key={lesson.id}>
                                <Link
                                  href={`/courses/${courseId}/lessons/${lesson.id}`}
                                  aria-current={isCurrent ? "page" : undefined}
                                  className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500",
                                    isCurrent
                                      ? "bg-primary-50 font-medium text-primary-700"
                                      : "text-neutral-700",
                                  )}
                                >
                                  <Icon
                                    size={16}
                                    strokeWidth={1.75}
                                    className="shrink-0 text-neutral-400"
                                    aria-hidden="true"
                                  />
                                  <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                                  {lesson.completed ? (
                                    <CheckCircle2
                                      size={16}
                                      strokeWidth={2}
                                      className="shrink-0 text-success-600"
                                      aria-label="Completed"
                                    />
                                  ) : (
                                    <Circle
                                      size={16}
                                      strokeWidth={1.75}
                                      className="shrink-0 text-neutral-300"
                                      aria-label="Not completed"
                                    />
                                  )}
                                </Link>
                              </li>
                            );
                          })}
                          {mod.lessons.length === 0 ? (
                            <li className="px-3 py-2.5 text-sm text-neutral-400">
                              No lessons yet.
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
