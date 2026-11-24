"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { SketchCommentView } from "@examora/types";
import { Button, FieldError, cn } from "@examora/ui";
import { Trash2, X } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { adminMediaUrl as mediaUrl } from "@/lib/media-api";

const KIND_LABEL: Record<SketchCommentView["authorKind"], string> = {
  OWNER: "Artist",
  EXPERT: "Expert",
  PEER: "Student",
};
const KIND_TONE = { OWNER: "neutral", EXPERT: "primary", PEER: "warning" } as const;
const PIN_CLASS: Record<SketchCommentView["authorKind"], string> = {
  OWNER: "bg-neutral-800 text-white dark:bg-white dark:text-neutral-900",
  EXPERT: "bg-primary-600 text-white",
  PEER: "bg-warning-500 text-neutral-900",
};

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Admin copy of the student app's pinned-comments viewer (apps/web components/student/sketch-pins.tsx).
 * A sketch with comments pinned to spots on it. Click (or press Enter, then
 * use the arrow keys) to place a pin, then write the comment.
 */
export function SketchPinsDialog({
  title,
  imageRef,
  imageAlt,
  load,
  add,
  remove,
  onClose,
}: {
  title: string;
  imageRef: string;
  imageAlt: string;
  load: () => Promise<SketchCommentView[]>;
  add: (c: { x: number; y: number; body: string }) => Promise<SketchCommentView[]>;
  remove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const loadRef = React.useRef(load);
  loadRef.current = load;
  const [comments, setComments] = React.useState<SketchCommentView[] | null>(null);
  const [draft, setDraft] = React.useState<{ x: number; y: number } | null>(null);
  const [body, setBody] = React.useState("");
  const [active, setActive] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const url = mediaUrl(imageRef);

  const refresh = React.useCallback(() => {
    loadRef
      .current()
      .then(setComments)
      .catch((err) => {
        setComments([]);
        setError(err instanceof ApiError ? err.message : "Couldn't load comments");
      });
  }, []);
  React.useEffect(() => refresh(), [refresh]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function place(e: React.MouseEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    setDraft({
      x: clamp((e.clientX - box.left) / box.width),
      y: clamp((e.clientY - box.top) / box.height),
    });
    setTimeout(() => textRef.current?.focus(), 0);
  }

  function onSurfaceKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = 0.03;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!draft) setDraft({ x: 0.5, y: 0.5 });
      else textRef.current?.focus();
      return;
    }
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = move[e.key];
    if (d && draft) {
      e.preventDefault();
      setDraft({ x: clamp(draft.x + d[0]), y: clamp(draft.y + d[1]) });
    }
  }

  async function save() {
    if (!draft || !body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      setComments(await add({ ...draft, body: body.trim() }));
      setDraft(null);
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the comment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pins-title"
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-card border border-neutral-200 bg-white shadow-soft-hover dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
          <h2
            id="pins-title"
            className="truncate text-base font-medium text-neutral-800 dark:text-white/90"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col items-center gap-2 bg-neutral-50 p-4 dark:bg-white/[0.02]">
            <p id="pins-help" className="text-xs text-neutral-500 dark:text-neutral-400">
              Click a spot on the sketch to comment on it. Keyboard: Enter, then arrow keys.
            </p>
            {url ? (
              <div
                role="button"
                tabIndex={0}
                aria-describedby="pins-help"
                aria-label="Sketch. Place a comment pin"
                onClick={place}
                onKeyDown={onSurfaceKey}
                className="relative inline-block cursor-crosshair select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <img
                  src={url}
                  alt={imageAlt}
                  className="block max-h-[70vh] max-w-full rounded-md"
                  draggable={false}
                />
                {(comments ?? []).map((c, i) => (
                  <span
                    key={c.id}
                    aria-hidden="true"
                    style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                    className={cn(
                      "absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold shadow ring-2 ring-white transition-transform dark:ring-neutral-900",
                      PIN_CLASS[c.authorKind],
                      active === c.id && "scale-125",
                    )}
                  >
                    {i + 1}
                  </span>
                ))}
                {draft ? (
                  <span
                    aria-hidden="true"
                    style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}
                    className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-dashed border-primary-600 bg-primary-100/70"
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                The image appears once its safety scan finishes.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-4 border-t border-neutral-200 p-4 lg:border-l lg:border-t-0 dark:border-neutral-800">
            {draft ? (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="pin-body"
                  className="text-sm font-medium text-neutral-800 dark:text-white/90"
                >
                  Comment on this spot
                </label>
                <textarea
                  id="pin-body"
                  ref={textRef}
                  rows={3}
                  maxLength={500}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="e.g. The vanishing point drifts here"
                  className="w-full rounded-md border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={!body.trim() || saving} onClick={() => void save()}>
                    {saving ? "Saving…" : "Add comment"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDraft(null);
                      setBody("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
            <FieldError>{error}</FieldError>
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Comments {comments ? `(${comments.length})` : ""}
              </h3>
              {comments === null ? (
                <p className="mt-2 text-sm text-neutral-500">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-500">No comments yet.</p>
              ) : (
                <ol className="mt-2 flex flex-col gap-2">
                  {comments.map((c, i) => (
                    <li
                      key={c.id}
                      onMouseEnter={() => setActive(c.id)}
                      onMouseLeave={() => setActive(null)}
                      className="rounded-md border border-neutral-200 p-2.5 text-sm dark:border-neutral-800"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                            PIN_CLASS[c.authorKind],
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="sr-only">Pin {i + 1}:</span>
                        <span className="min-w-0 flex-1 truncate font-medium text-neutral-800 dark:text-white/90">
                          {c.mine ? "You" : c.authorName}
                        </span>
                        <Chip tone={KIND_TONE[c.authorKind]}>{KIND_LABEL[c.authorKind]}</Chip>
                        {c.mine ? (
                          <button
                            type="button"
                            aria-label="Delete comment"
                            onClick={async () => {
                              await remove(c.id).catch(() => undefined);
                              refresh();
                            }}
                            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-danger-600 dark:hover:bg-white/5"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                        {c.body}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
