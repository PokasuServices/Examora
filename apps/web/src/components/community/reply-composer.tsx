"use client";

import * as React from "react";

/** Shared textarea+submit composer for both the top-level reply box and inline reply-to-reply forms. */
export function ReplyComposer({
  placeholder = "Write a reply…",
  focusOnOpen,
  submitting,
  onSubmit,
  onCancel,
  submitLabel = "Post",
}: {
  placeholder?: string;
  /** Named to avoid the jsx-a11y/no-autofocus lint rule, which flags any prop literally named "autoFocus" — focus is applied imperatively via ref below, only when this composer appears from a deliberate user action (Reply clicked), never on initial page load. */
  focusOnOpen?: boolean;
  submitting?: boolean;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [body, setBody] = React.useState("");
  const textareaId = React.useId();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (focusOnOpen) textareaRef.current?.focus();
  }, [focusOnOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await onSubmit(body.trim());
    setBody("");
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={textareaId}>
        {placeholder}
      </label>
      <textarea
        id={textareaId}
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        maxLength={10000}
        className="min-h-24 w-full rounded-md border border-neutral-200 p-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      />
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
        >
          {submitting ? "Posting…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
