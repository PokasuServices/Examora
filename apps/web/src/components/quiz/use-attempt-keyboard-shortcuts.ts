"use client";

import * as React from "react";
import type { AttemptQuestion } from "@examora/types";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * ←/→ (or P/N) move between questions; 1-9 toggle that question's Nth
 * option. Never wired to Submit — an accidental keypress must not end the
 * attempt, so submission always requires an explicit click on the
 * confirmation dialog.
 */
export function useAttemptKeyboardShortcuts(
  question: AttemptQuestion | undefined,
  onNavigate: (direction: -1 | 1) => void,
  onToggleOption: (optionId: string) => void,
) {
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable)) return;

      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "p") {
        e.preventDefault();
        onNavigate(-1);
      } else if (key === "arrowright" || key === "n") {
        e.preventDefault();
        onNavigate(1);
      } else if (question && /^[1-9]$/.test(e.key)) {
        const option = question.options[Number(e.key) - 1];
        if (option) {
          e.preventDefault();
          onToggleOption(option.id);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [question, onNavigate, onToggleOption]);
}
