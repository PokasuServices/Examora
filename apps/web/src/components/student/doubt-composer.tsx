"use client";

import * as React from "react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Sigma,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Underline,
  X,
} from "lucide-react";
import {
  DOUBT_BODY_MAX,
  DOUBT_IMAGE_MAX_BYTES,
  DOUBT_IMAGE_TYPES,
  type AttemptReviewQuestion,
  type DoubtKind,
} from "@examora/types";
import { Button, cn } from "@examora/ui";
import { QuizReviewQuestionCard } from "@/components/quiz/quiz-review-question";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { putToStorage, useStudentApi } from "@/lib/student-api";
import { DoubtMarkdown } from "./doubt-markdown";

type Edit = { text: string; selStart: number; selEnd: number };

/** Wraps the selection (or a placeholder) in before/after markers. */
function wrap(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): Edit {
  const selected = value.slice(start, end) || placeholder;
  const text = value.slice(0, start) + before + selected + after + value.slice(end);
  return { text, selStart: start + before.length, selEnd: start + before.length + selected.length };
}

/** Prefixes every line touched by the selection (lists, quotes, headings). */
function prefixLines(
  value: string,
  start: number,
  end: number,
  prefix: (i: number) => string,
): Edit {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIdx = value.indexOf("\n", end);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const block = lines.map((l, i) => prefix(i) + l).join("\n");
  const text = value.slice(0, lineStart) + block + value.slice(lineEnd);
  return { text, selStart: lineStart, selEnd: lineStart + block.length };
}

/** Inserts text at the cursor (replacing any selection) and selects `select` within it. */
function insert(
  value: string,
  start: number,
  end: number,
  text: string,
  select?: [number, number],
): Edit {
  const out = value.slice(0, start) + text + value.slice(end);
  const [a, b] = select ?? [text.length, text.length];
  return { text: out, selStart: start + a, selEnd: start + b };
}

/** Removes formatting marks from the selection. */
function clearMarks(value: string, start: number, end: number): Edit {
  const selected = value.slice(start, end);
  const plain = selected
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/(\*\*|__|\+\+|==|~~)([\s\S]*?)\1/g, "$2")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~([^~\s]+)~/g, "$1")
    .replace(/\^([^^\s]+)\^/g, "$1")
    .replace(/^(#{1,6} |> |- |\d+\. )/gm, "");
  return {
    text: value.slice(0, start) + plain + value.slice(end),
    selStart: start,
    selEnd: start + plain.length,
  };
}

const TABLE = "\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n";

type Tool = {
  key: string;
  label: string;
  icon: typeof Bold;
  group: number;
  apply: (v: string, s: number, e: number) => Edit;
};

const TOOLS: Tool[] = [
  {
    key: "bold",
    label: "Bold",
    icon: Bold,
    group: 1,
    apply: (v, s, e) => wrap(v, s, e, "**", "**", "bold text"),
  },
  {
    key: "italic",
    label: "Italic",
    icon: Italic,
    group: 1,
    apply: (v, s, e) => wrap(v, s, e, "_", "_", "italic text"),
  },
  {
    key: "underline",
    label: "Underline",
    icon: Underline,
    group: 1,
    apply: (v, s, e) => wrap(v, s, e, "++", "++", "underlined"),
  },
  {
    key: "strike",
    label: "Strikethrough",
    icon: Strikethrough,
    group: 1,
    apply: (v, s, e) => wrap(v, s, e, "~~", "~~", "crossed out"),
  },
  {
    key: "highlight",
    label: "Highlight",
    icon: Highlighter,
    group: 1,
    apply: (v, s, e) => wrap(v, s, e, "==", "==", "key point"),
  },
  {
    key: "h1",
    label: "Large heading",
    icon: Heading1,
    group: 2,
    apply: (v, s, e) => prefixLines(v, s, e, () => "# "),
  },
  {
    key: "h2",
    label: "Small heading",
    icon: Heading2,
    group: 2,
    apply: (v, s, e) => prefixLines(v, s, e, () => "## "),
  },
  {
    key: "quote",
    label: "Quote",
    icon: Quote,
    group: 2,
    apply: (v, s, e) => prefixLines(v, s, e, () => "> "),
  },
  {
    key: "code",
    label: "Code",
    icon: Code,
    group: 2,
    apply: (v, s, e) => wrap(v, s, e, "`", "`", "code"),
  },
  {
    key: "bullets",
    label: "Bulleted list",
    icon: List,
    group: 3,
    apply: (v, s, e) => prefixLines(v, s, e, () => "- "),
  },
  {
    key: "numbers",
    label: "Numbered list",
    icon: ListOrdered,
    group: 3,
    apply: (v, s, e) => prefixLines(v, s, e, (i) => `${i + 1}. `),
  },
  {
    key: "table",
    label: "Table",
    icon: Table,
    group: 3,
    apply: (v, s, e) => insert(v, s, e, TABLE, [3, 11]),
  },
  {
    key: "sub",
    label: "Subscript (H₂O)",
    icon: Subscript,
    group: 4,
    apply: (v, s, e) => wrap(v, s, e, "~", "~", "2"),
  },
  {
    key: "sup",
    label: "Superscript (x²)",
    icon: Superscript,
    group: 4,
    apply: (v, s, e) => wrap(v, s, e, "^", "^", "2"),
  },
  {
    key: "formula",
    label: "Formula",
    icon: Sigma,
    group: 4,
    apply: (v, s, e) => wrap(v, s, e, "$$", "$$", "\\frac{a}{b} = c^2"),
  },
  {
    key: "link",
    label: "Link",
    icon: Link2,
    group: 5,
    apply: (v, s, e) => wrap(v, s, e, "[", "](https://)", "link text"),
  },
  { key: "clear", label: "Clear formatting", icon: RemoveFormatting, group: 6, apply: clearMarks },
];

/** Formula snippets for the formula help (KaTeX syntax). */
const FORMULA_EXAMPLES: { label: string; tex: string }[] = [
  { label: "Fraction", tex: "\\frac{a}{b}" },
  { label: "Power", tex: "x^{2}" },
  { label: "Root", tex: "\\sqrt{x}" },
  { label: "Angle", tex: "\\angle ABC = 90^\\circ" },
  { label: "Ratio", tex: "a : b = 3 : 4" },
  { label: "π r²", tex: "\\pi r^{2}" },
];

const KIND_OPTIONS: { value: DoubtKind; label: string }[] = [
  { value: "DOUBT", label: "Ask a doubt" },
  { value: "EXPLANATION", label: "Post an explanation" },
];

const PLACEHOLDER: Record<DoubtKind, string> = {
  DOUBT: "What's unclear? Say which step or option confuses you.",
  EXPLANATION: "Explain how you solved it, step by step. Add a diagram if it helps.",
};

/**
 * "Post a doubt / explanation" dialog: the question and its official
 * explanation on the left, a Markdown editor (toolbar, preview, 1 MB images)
 * on the right.
 */
const MARKS: { write: string; result: React.ReactNode }[] = [
  { write: "**bold**", result: <strong>bold</strong> },
  { write: "_italic_", result: <em>italic</em> },
  { write: "++underline++", result: <u>underline</u> },
  { write: "~~crossed~~", result: <del>crossed</del> },
  {
    write: "==key point==",
    result: <mark className="rounded bg-amber-100 px-0.5 dark:bg-amber-400/25">key point</mark>,
  },
  {
    write: "H~2~O, x^2^",
    result: (
      <>
        H<sub>2</sub>O, x<sup>2</sup>
      </>
    ),
  },
];

/** Collapsible cheat sheet of the marks, plus one-click formula snippets. */
function FormattingHelp({ onFormula }: { onFormula: (tex: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  return (
    <div className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-neutral-600 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-400 dark:hover:text-white/90"
      >
        <Sigma size={14} aria-hidden="true" /> Formatting and formula help
        <span aria-hidden="true" className="ml-auto">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="grid gap-4 px-3 pb-3 text-xs sm:grid-cols-2">
          <table className="w-full">
            <caption className="mb-1 text-left font-medium text-neutral-700 dark:text-neutral-300">
              Type this → get this
            </caption>
            <tbody>
              {MARKS.map((m) => (
                <tr key={m.write}>
                  <td className="py-0.5 pr-3 font-mono text-neutral-500">{m.write}</td>
                  <td className="py-0.5 text-neutral-800 dark:text-neutral-200">{m.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <p className="mb-1 font-medium text-neutral-700 dark:text-neutral-300">
              Formulas go between $$ … $$. Click one to insert it:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FORMULA_EXAMPLES.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => onFormula(f.tex)}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DoubtComposer({
  questionId,
  question,
  questionIndex,
  initialKind,
  onClose,
  onPosted,
}: {
  questionId: string;
  question?: AttemptReviewQuestion;
  questionIndex?: number;
  initialKind: DoubtKind;
  onClose: () => void;
  onPosted: () => void;
}) {
  const api = useStudentApi();
  const [kind, setKind] = React.useState<DoubtKind>(initialKind);
  const [body, setBody] = React.useState("");
  const [mode, setMode] = React.useState<"write" | "preview">("write");
  const [uploading, setUploading] = React.useState(false);
  const [posting, setPosting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const editorId = React.useId();

  const tryClose = React.useCallback(() => {
    if (body.trim() && !window.confirm("Discard what you've written?")) return;
    onClose();
  }, [body, onClose]);

  React.useEffect(() => {
    textRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        tryClose();
      }
      // Keep keyboard focus inside the dialog.
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea, input:not([type="file"]), a[href], [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tryClose]);

  function applyEdit(edit: Edit) {
    setBody(edit.text.slice(0, DOUBT_BODY_MAX));
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(edit.selStart, edit.selEnd);
    });
  }

  function runTool(apply: (v: string, s: number, e: number) => Edit) {
    setMode("write");
    const el = textRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    applyEdit(apply(body, start, end));
  }

  async function addImage(file: File) {
    setError(null);
    if (!(DOUBT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError("Use a PNG, JPEG, WebP or GIF image.");
      return;
    }
    if (file.size > DOUBT_IMAGE_MAX_BYTES) {
      setError("Images must be 1 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const presigned = await api.presignDoubtImage(questionId, file);
      await putToStorage(presigned.url, file);
      const image = await api.confirmDoubtImage(file, presigned.key);
      const el = textRef.current;
      const at = el?.selectionEnd ?? body.length;
      const alt = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[[\]]/g, "") || "image";
      const insert = `${at > 0 && body[at - 1] !== "\n" ? "\n" : ""}![${alt}](${image.ref})\n`;
      applyEdit({
        text: body.slice(0, at) + insert + body.slice(at),
        selStart: at + insert.length,
        selEnd: at + insert.length,
      });
    } catch {
      setError("Couldn't upload the image. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setPosting(true);
    setError(null);
    try {
      await api.postDoubt(questionId, body.trim(), undefined, kind);
      onPosted();
    } catch (err) {
      const message = (err as { message?: string })?.message;
      setError(message && message.length < 120 ? message : "Couldn't post. Try again.");
      setPosting(false);
    }
  }

  const tooShort = body.trim().length < 2;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-neutral-900/50" onClick={tryClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-soft-hover dark:bg-neutral-900 sm:max-h-[90vh] sm:rounded-card sm:border sm:border-neutral-200 sm:dark:border-neutral-800"
      >
        <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
          <h2 id={titleId} className="text-base font-medium text-neutral-800 dark:text-white/90">
            {kind === "DOUBT" ? "Ask a doubt" : "Post your explanation"}
          </h2>
          <button
            type="button"
            onClick={tryClose}
            aria-label="Close"
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-white/5"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className={cn("grid min-h-0 flex-1 overflow-y-auto", question && "lg:grid-cols-2")}>
          {question ? (
            <div className="border-b border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-white/[0.02] lg:max-h-[calc(90vh-7.5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                The question
              </p>
              <QuizReviewQuestionCard question={question} index={questionIndex ?? 0} />
            </div>
          ) : null}

          <div className="flex min-w-0 flex-col gap-3 p-5">
            <div className="overflow-x-auto">
              <SegmentedControl
                aria-label="Type of post"
                options={KIND_OPTIONS}
                value={kind}
                onChange={setKind}
              />
            </div>

            <div className="flex flex-col rounded-md border border-neutral-300 focus-within:ring-2 focus-within:ring-primary-500 dark:border-neutral-700">
              <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 px-1.5 py-1 dark:border-neutral-800">
                <div
                  role="toolbar"
                  aria-label="Formatting"
                  aria-controls={editorId}
                  className="flex flex-wrap gap-0.5"
                >
                  {TOOLS.map((t, i) => {
                    const Icon = t.icon;
                    const divider = i > 0 && TOOLS[i - 1]!.group !== t.group;
                    return (
                      <React.Fragment key={t.key}>
                        {divider ? (
                          <span
                            aria-hidden="true"
                            className="mx-0.5 my-1 w-px self-stretch bg-neutral-200 dark:bg-neutral-700"
                          />
                        ) : null}
                        <button
                          type="button"
                          title={t.label}
                          aria-label={t.label}
                          onClick={() => runTool(t.apply)}
                          className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-300 dark:hover:bg-white/5"
                        >
                          <Icon size={16} aria-hidden="true" />
                        </button>
                      </React.Fragment>
                    );
                  })}
                  <button
                    type="button"
                    title="Add an image (1 MB max)"
                    aria-label="Add an image, 1 MB max"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-white/5"
                  >
                    <ImagePlus size={16} aria-hidden="true" />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={DOUBT_IMAGE_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void addImage(file);
                    }}
                  />
                </div>
                <div className="ml-auto flex gap-1 text-xs">
                  {(["write", "preview"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      onClick={() => setMode(m)}
                      className={cn(
                        "rounded px-2 py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                        mode === m
                          ? "bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-white/90"
                          : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400",
                      )}
                    >
                      {m === "write" ? "Write" : "Preview"}
                    </button>
                  ))}
                </div>
              </div>
              {mode === "write" ? (
                <textarea
                  id={editorId}
                  ref={textRef}
                  aria-label={kind === "DOUBT" ? "Your doubt" : "Your explanation"}
                  placeholder={PLACEHOLDER[kind]}
                  value={body}
                  maxLength={DOUBT_BODY_MAX}
                  onChange={(e) => setBody(e.target.value)}
                  onPaste={(e) => {
                    const file = [...e.clipboardData.files].find((f) =>
                      f.type.startsWith("image/"),
                    );
                    if (file) {
                      e.preventDefault();
                      void addImage(file);
                    }
                  }}
                  className="min-h-[16rem] w-full resize-y rounded-b-md bg-white p-3 text-sm focus-visible:outline-none dark:bg-neutral-900"
                />
              ) : (
                <div className="min-h-[16rem] p-3">
                  {body.trim() ? (
                    <DoubtMarkdown body={body} />
                  ) : (
                    <p className="text-sm text-neutral-400">Nothing to preview yet.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span>
                {uploading
                  ? "Uploading image…"
                  : "Images: PNG, JPEG, WebP or GIF, up to 1 MB. They appear once a safety check finishes."}
              </span>
              <span className="tabular-nums">
                {body.length} / {DOUBT_BODY_MAX}
              </span>
            </div>
            <FormattingHelp
              onFormula={(tex) => {
                setMode("write");
                const el = textRef.current;
                const start = el?.selectionStart ?? body.length;
                const end = el?.selectionEnd ?? body.length;
                applyEdit(insert(body, start, end, `$$${tex}$$`));
              }}
            />
            {error ? (
              <p role="alert" className="text-sm text-danger-600">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
          <Button variant="ghost" onClick={tryClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={tooShort || posting || uploading}>
            {posting ? "Posting…" : kind === "DOUBT" ? "Post doubt" : "Post explanation"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
