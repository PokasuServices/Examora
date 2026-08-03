"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { LessonWithProgress } from "@examora/types";
import { Button } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { useLearningApi } from "@/lib/learning-api";

function LessonContent() {
  const { id: courseId, lessonId } = useParams<{ id: string; lessonId: string }>();
  const router = useRouter();
  const api = useLearningApi();
  const [lesson, setLesson] = React.useState<LessonWithProgress | null>(null);
  const [completed, setCompleted] = React.useState(false);
  const [notFound, setNotFound] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api
      .getLesson(lessonId)
      .then((l) => {
        setLesson(l);
        setCompleted(l.completed);
        // Record the view as a side effect of opening the lesson.
        void api.recordView(lessonId).catch(() => undefined);
      })
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function markComplete(): Promise<void> {
    setSaving(true);
    try {
      await api.completeLesson(lessonId);
      setCompleted(true);
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-heading">Lesson not available</h1>
        <Link
          href={`/courses/${courseId}`}
          className="mt-4 inline-block text-sm text-primary-600 hover:underline"
        >
          Back to course
        </Link>
      </main>
    );
  }

  if (!lesson) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href={`/courses/${courseId}`} className="hover:underline">
          Course
        </Link>{" "}
        · <span className="text-neutral-800">{lesson.title}</span>
      </nav>

      <div className="flex items-center gap-3">
        <h1 className="text-heading">{lesson.title}</h1>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
          {lesson.contentType}
        </span>
      </div>

      <article className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        {lesson.contentType === "TEXT" || lesson.contentType === "ARTICLE" ? (
          <div className="whitespace-pre-wrap text-body text-neutral-800">
            {lesson.body ?? "No content."}
          </div>
        ) : lesson.contentUrl ? (
          <a
            href={lesson.contentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary-600 hover:underline"
          >
            Open {lesson.contentType.toLowerCase()} resource ↗
          </a>
        ) : (
          <p className="text-neutral-500">No content available.</p>
        )}
      </article>

      <div className="mt-6 flex items-center gap-3">
        {completed ? (
          <span className="text-sm font-medium text-success-600">✓ Completed</span>
        ) : (
          <Button disabled={saving} onClick={() => void markComplete()}>
            {saving ? "Saving…" : "Mark as complete"}
          </Button>
        )}
        <Button variant="ghost" onClick={() => router.push(`/courses/${courseId}`)}>
          Back to course
        </Button>
      </div>
    </main>
  );
}

export default function LessonPage() {
  return (
    <RequireAuth>
      <LessonContent />
    </RequireAuth>
  );
}
