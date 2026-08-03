"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { FlatLesson } from "./types";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** ←/P for previous lesson, →/N for next — ignored while typing anywhere, or with a modifier key held (never hijacks browser/OS shortcuts). */
export function useLessonKeyboardShortcuts(
  courseId: string,
  previousLesson: FlatLesson | null,
  nextLesson: FlatLesson | null,
) {
  const router = useRouter();

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable)) return;

      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "p") {
        if (previousLesson) {
          e.preventDefault();
          router.push(`/courses/${courseId}/lessons/${previousLesson.lessonId}`);
        }
      } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "n") {
        if (nextLesson) {
          e.preventDefault();
          router.push(`/courses/${courseId}/lessons/${nextLesson.lessonId}`);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [courseId, previousLesson, nextLesson, router]);
}
