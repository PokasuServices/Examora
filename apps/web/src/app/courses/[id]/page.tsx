"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { CourseProgress, Curriculum } from "@examora/types";
import { Button } from "@examora/ui";
import { ProgressBar } from "@/components/progress-bar";
import { RequireAuth } from "@/components/require-auth";
import { useLearningApi } from "@/lib/learning-api";

function CourseContent() {
  const { id } = useParams<{ id: string }>();
  const api = useLearningApi();
  const [curriculum, setCurriculum] = React.useState<Curriculum | null>(null);
  const [progress, setProgress] = React.useState<CourseProgress | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    Promise.all([api.getCurriculum(id), api.getCourseProgress(id)])
      .then(([c, p]) => {
        setCurriculum(c);
        setProgress(p);
      })
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-heading">Course not available</h1>
        <Link
          href="/courses"
          className="mt-4 inline-block text-sm text-primary-600 hover:underline"
        >
          Back to courses
        </Link>
      </main>
    );
  }

  if (!curriculum || !progress) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/courses" className="hover:underline">
          Courses
        </Link>{" "}
        · <span className="text-neutral-800">{curriculum.title}</span>
      </nav>

      <h1 className="text-heading">{curriculum.title}</h1>
      {curriculum.description ? (
        <p className="mt-2 text-neutral-600">{curriculum.description}</p>
      ) : null}

      <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-600">
            {progress.completedLessons} of {progress.totalLessons} lessons ·{" "}
            {progress.percentComplete}%
          </span>
          {progress.nextLesson ? (
            <Link href={`/courses/${id}/lessons/${progress.nextLesson.id}`}>
              <Button>{progress.completedLessons > 0 ? "Continue" : "Start learning"}</Button>
            </Link>
          ) : (
            <span className="text-sm font-medium text-success-600">Completed 🎉</span>
          )}
        </div>
        <div className="mt-3">
          <ProgressBar percent={progress.percentComplete} />
        </div>
      </div>

      <section className="mt-8 flex flex-col gap-6">
        {curriculum.subjects.map((subject) => (
          <div key={subject.id}>
            <h2 className="text-lg font-semibold">{subject.title}</h2>
            {subject.topics.map((topic) => (
              <div key={topic.id} className="mt-3">
                <h3 className="text-sm font-medium text-neutral-700">{topic.title}</h3>
                {topic.modules.map((mod) => (
                  <div key={mod.id} className="mt-2">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">{mod.title}</p>
                    <ul className="mt-1 flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
                      {mod.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          <Link
                            href={`/courses/${id}/lessons/${lesson.id}`}
                            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50"
                          >
                            <span>{lesson.title}</span>
                            <span
                              className={lesson.completed ? "text-success-600" : "text-neutral-300"}
                              aria-label={lesson.completed ? "Completed" : "Not completed"}
                            >
                              ✓
                            </span>
                          </Link>
                        </li>
                      ))}
                      {mod.lessons.length === 0 ? (
                        <li className="px-4 py-3 text-sm text-neutral-400">No lessons yet.</li>
                      ) : null}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}

export default function CoursePage() {
  return (
    <RequireAuth>
      <CourseContent />
    </RequireAuth>
  );
}
