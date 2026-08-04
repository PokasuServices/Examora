"use client";

import * as React from "react";
import { AutosaveIndicator, type AutosaveStatus } from "@/components/ui/autosave-indicator";

const DEBOUNCE_MS = 1200;

export function SubmissionNotes({
  value,
  onChange,
  onSave,
  status,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  status: AutosaveStatus;
  disabled: boolean;
}) {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(next: string) {
    onChange(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSave(next), DEBOUNCE_MS);
  }

  function handleBlur() {
    if (timerRef.current) clearTimeout(timerRef.current);
    onSave(value);
  }

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor="submission-notes" className="text-sm font-medium text-neutral-800">
          Notes for your reviewer
        </label>
        <AutosaveIndicator status={status} />
      </div>
      <textarea
        id="submission-notes"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder="Add context for your reviewer — optional"
        className="mt-2 min-h-28 w-full rounded-md border border-neutral-200 p-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
      />
    </div>
  );
}
