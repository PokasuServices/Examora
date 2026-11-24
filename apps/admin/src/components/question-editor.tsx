"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import {
  DIFFICULTY_LEVELS,
  QUESTION_TYPES,
  type DifficultyLevel,
  type Question,
  type QuestionType,
} from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { MediaField } from "@/components/media-field";
import { TopicPicker } from "@/components/topic-picker";
import { SelectField } from "@/components/ui/select-field";
import { useAssessmentApi, type QuestionInput } from "@/lib/assessment-api";

const TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
  TRUE_FALSE: "True / False",
  NUMERIC: "Numeric answer",
  UPLOAD: "Sketch upload (reviewer marks it)",
};
const LEVEL_LABEL: Record<DifficultyLevel, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

interface OptionDraft {
  text: string;
  imageUrl: string;
  isCorrect: boolean;
}
interface ResourceDraft {
  label: string;
  url: string;
}

const TEXTAREA =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-sm text-neutral-900 dark:text-white/90 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600";

const blankOptions = (type: QuestionType): OptionDraft[] =>
  type === "TRUE_FALSE"
    ? [
        { text: "True", imageUrl: "", isCorrect: true },
        { text: "False", imageUrl: "", isCorrect: false },
      ]
    : [
        { text: "", imageUrl: "", isCorrect: true },
        { text: "", imageUrl: "", isCorrect: false },
      ];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <legend className="px-1 text-sm font-semibold text-neutral-800 dark:text-white/90">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Create or edit a question with everything the student screens can show:
 * images on the question and options, numeric answers with an accepted
 * range, partial marks for multi-select, and an explanation with image,
 * video and further-reading links.
 */
export function QuestionEditor({
  initial,
  onSaved,
}: {
  /** Omit to create a new question. */
  initial?: Question;
  onSaved: (question: Question) => void;
}) {
  const api = useAssessmentApi();
  const [type, setType] = React.useState<QuestionType>(initial?.type ?? "SINGLE_CHOICE");
  const [difficulty, setDifficulty] = React.useState<DifficultyLevel>(
    initial?.difficulty ?? "MEDIUM",
  );
  const [text, setText] = React.useState(initial?.text ?? "");
  const [imageUrl, setImageUrl] = React.useState(initial?.imageUrl ?? "");
  const [options, setOptions] = React.useState<OptionDraft[]>(
    initial && initial.options.length > 0
      ? initial.options.map((o) => ({
          text: o.text,
          imageUrl: o.imageUrl ?? "",
          isCorrect: o.isCorrect,
        }))
      : blankOptions(initial?.type ?? "SINGLE_CHOICE"),
  );
  const [numericMin, setNumericMin] = React.useState(initial?.numericMin?.toString() ?? "");
  const [numericMax, setNumericMax] = React.useState(initial?.numericMax?.toString() ?? "");
  const [partialMarking, setPartialMarking] = React.useState(initial?.partialMarking ?? false);
  const [explanation, setExplanation] = React.useState(initial?.explanation ?? "");
  const [explanationImageUrl, setExplanationImageUrl] = React.useState(
    initial?.explanationImageUrl ?? "",
  );
  const [explanationVideoUrl, setExplanationVideoUrl] = React.useState(
    initial?.explanationVideoUrl ?? "",
  );
  const [resources, setResources] = React.useState<ResourceDraft[]>(initial?.resources ?? []);
  const [steps, setSteps] = React.useState<{ imageUrl: string; caption: string }[]>(
    (initial?.explanationSteps ?? []).map((s) => ({
      imageUrl: s.imageUrl,
      caption: s.caption ?? "",
    })),
  );
  const [tags, setTags] = React.useState((initial?.tags ?? []).join(", "));
  const [subjectId, setSubjectId] = React.useState<string | null>(initial?.subjectId ?? null);
  const [topicId, setTopicId] = React.useState<string | null>(initial?.topicId ?? null);
  const [criteria, setCriteria] = React.useState((initial?.criteria ?? []).join("\n"));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const singleAnswer = type === "SINGLE_CHOICE" || type === "TRUE_FALSE";

  function changeType(next: QuestionType) {
    setType(next);
    if (next === "TRUE_FALSE") setOptions(blankOptions("TRUE_FALSE"));
    else if (next !== "NUMERIC" && options.length < 2) setOptions(blankOptions(next));
    else if (next === "SINGLE_CHOICE") {
      // Keep only the first correct option.
      let seen = false;
      setOptions((prev) =>
        prev.map((o) => {
          const keep = o.isCorrect && !seen;
          if (o.isCorrect) seen = true;
          return { ...o, isCorrect: keep };
        }),
      );
    }
  }

  function updateOption(index: number, patch: Partial<OptionDraft>) {
    setOptions((prev) =>
      prev.map((o, i) => {
        if (patch.isCorrect !== undefined && singleAnswer) {
          return i === index ? { ...o, ...patch } : { ...o, isCorrect: false };
        }
        return i === index ? { ...o, ...patch } : o;
      }),
    );
  }

  function buildPayload(): QuestionInput | string {
    const numeric = type === "NUMERIC";
    const upload = type === "UPLOAD";
    const criteriaList = criteria
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);
    if (upload && criteriaList.length === 0)
      return "List at least one criterion the sketch is rated on.";
    const min = Number(numericMin);
    const max = Number(numericMax);
    if (numeric) {
      if (
        numericMin.trim() === "" ||
        numericMax.trim() === "" ||
        !Number.isFinite(min) ||
        !Number.isFinite(max)
      ) {
        return "Enter the lowest and highest accepted answer (use the same number for an exact answer).";
      }
      if (min > max) return "The lowest accepted answer can't be greater than the highest.";
    }
    const cleanOptions =
      numeric || upload
        ? []
        : options
            .filter((o) => o.text.trim() || o.imageUrl)
            .map((o) => ({
              text: o.text.trim(),
              imageUrl: o.imageUrl || null,
              isCorrect: o.isCorrect,
            }));
    if (!numeric && !upload && cleanOptions.length < 2)
      return "Add at least two options (text or image).";
    if (!numeric && !upload && !cleanOptions.some((o) => o.isCorrect))
      return "Mark the correct option.";
    const cleanResources = resources.filter((r) => r.label.trim() && r.url.trim());
    return {
      type,
      difficulty,
      text: text.trim(),
      imageUrl: imageUrl || null,
      options: cleanOptions,
      numericMin: numeric ? min : null,
      numericMax: numeric ? max : null,
      partialMarking: type === "MULTIPLE_CHOICE" ? partialMarking : false,
      explanation: explanation.trim(),
      explanationImageUrl: explanationImageUrl || null,
      explanationVideoUrl: explanationVideoUrl || null,
      explanationSteps: steps
        .filter((s) => s.imageUrl)
        .map((s) => ({ imageUrl: s.imageUrl, caption: s.caption.trim() || null })),
      resources: cleanResources.map((r) => ({ label: r.label.trim(), url: r.url.trim() })),
      subjectId: subjectId ?? undefined,
      topicId,
      criteria: upload ? criteriaList : [],
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const payload = buildPayload();
    if (typeof payload === "string") {
      setError(payload);
      return;
    }
    setSaving(true);
    try {
      const result = initial
        ? await api.updateQuestion(initial.id, payload)
        : await api.createQuestion(payload);
      setSaved(true);
      onSaved(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the question");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="question-type"
          label="Type"
          value={type}
          options={QUESTION_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
          onChange={(v) => changeType(v as QuestionType)}
        />
        <SelectField
          id="question-difficulty"
          label="Difficulty"
          value={difficulty}
          options={DIFFICULTY_LEVELS.map((d) => ({ value: d, label: LEVEL_LABEL[d] }))}
          onChange={(v) => setDifficulty(v as DifficultyLevel)}
        />
      </div>

      <Section title="Question">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="question-text">Question text</Label>
          <textarea
            id="question-text"
            className={`${TEXTAREA} min-h-20`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </div>
        <MediaField
          id="question-image"
          label="Question image (optional)"
          kind="image"
          value={imageUrl}
          onChange={setImageUrl}
        />
        <TopicPicker
          subjectId={subjectId}
          topicId={topicId}
          onChange={(v) => {
            setSubjectId(v.subjectId);
            setTopicId(v.topicId);
          }}
        />
      </Section>

      {type === "UPLOAD" ? (
        <Section title="Rating criteria">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            One per line. Students rate their own sketch on these, reviewers mark it on them, and
            the marks come from Assessment → Sketch review.
          </p>
          <textarea
            aria-label="Rating criteria, one per line"
            className={`${TEXTAREA} min-h-24`}
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            placeholder={"Observation\nComposition\nPerspective"}
          />
        </Section>
      ) : type === "NUMERIC" ? (
        <Section title="Accepted answer">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Any answer from the lowest to the highest value (inclusive) is marked correct. Use the
            same number twice for an exact answer.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="numeric-min">Lowest accepted</Label>
              <Input
                id="numeric-min"
                inputMode="decimal"
                value={numericMin}
                onChange={(e) => setNumericMin(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="numeric-max">Highest accepted</Label>
              <Input
                id="numeric-max"
                inputMode="decimal"
                value={numericMax}
                onChange={(e) => setNumericMax(e.target.value)}
              />
            </div>
          </div>
        </Section>
      ) : (
        <Section title="Options">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {singleAnswer ? "Mark the one correct option." : "Mark every correct option."} An option
            can be text, an image, or both.
          </p>
          <ol className="flex flex-col gap-4">
            {options.map((o, i) => (
              <li
                key={i}
                className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3 dark:bg-white/[0.03]"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-6 text-sm font-medium text-neutral-500">{i + 1}.</span>
                  <Input
                    aria-label={`Option ${i + 1} text`}
                    value={o.text}
                    onChange={(e) => updateOption(i, { text: e.target.value })}
                    disabled={type === "TRUE_FALSE"}
                    className="min-w-[200px] flex-1"
                  />
                  <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <input
                      type={singleAnswer ? "radio" : "checkbox"}
                      name="correct-option"
                      checked={o.isCorrect}
                      onChange={(e) =>
                        updateOption(i, { isCorrect: singleAnswer ? true : e.target.checked })
                      }
                    />
                    Correct
                  </label>
                  {type !== "TRUE_FALSE" && options.length > 2 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                {type !== "TRUE_FALSE" ? (
                  <div className="pl-9">
                    <MediaField
                      id={`option-image-${i}`}
                      label={`Option ${i + 1} image (optional)`}
                      kind="image"
                      value={o.imageUrl}
                      onChange={(v) => updateOption(i, { imageUrl: v })}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          {type !== "TRUE_FALSE" && options.length < 10 ? (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions((prev) => [...prev, { text: "", imageUrl: "", isCorrect: false }])
                }
              >
                Add option
              </Button>
            </div>
          ) : null}
          {type === "MULTIPLE_CHOICE" ? (
            <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={partialMarking}
                onChange={(e) => setPartialMarking(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Partial marks: picking some of the correct options (and no wrong one) earns that
                share of the marks.
              </span>
            </label>
          ) : null}
        </Section>
      )}

      <Section title="Explanation (shown after submitting)">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="question-explanation">Explanation text</Label>
          <textarea
            id="question-explanation"
            className={`${TEXTAREA} min-h-20`}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Markdown is supported, e.g. **bold** or ![figure](media:…)"
          />
        </div>
        <MediaField
          id="explanation-image"
          label="Explanation image (optional)"
          kind="image"
          value={explanationImageUrl}
          onChange={setExplanationImageUrl}
        />
        <MediaField
          id="explanation-video"
          label="Video solution (optional)"
          kind="video"
          value={explanationVideoUrl}
          onChange={setExplanationVideoUrl}
          hint="Paste a YouTube or Vimeo link, or upload an MP4/WebM file (up to 500 MB)."
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Step-by-step images (optional)
          </span>
          <p className="text-xs text-neutral-500">
            Students see these one at a time as Step 1, Step 2… Add a short caption for each.
          </p>
          {steps.map((s, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
            >
              <MediaField
                id={`explanation-step-${i}`}
                label={`Step ${i + 1} image`}
                kind="image"
                value={s.imageUrl}
                onChange={(v) =>
                  setSteps((prev) => prev.map((x, j) => (j === i ? { ...x, imageUrl: v } : x)))
                }
              />
              <Input
                aria-label={`Step ${i + 1} caption`}
                placeholder="What this step shows"
                maxLength={300}
                value={s.caption}
                onChange={(e) =>
                  setSteps((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)),
                  )
                }
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={i === 0}
                  onClick={() =>
                    setSteps((prev) => {
                      const next = [...prev];
                      [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                      return next;
                    })
                  }
                >
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {steps.length < 12 ? (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSteps((prev) => [...prev, { imageUrl: "", caption: "" }])}
              >
                Add step image
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Reference links
          </span>
          {resources.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={`Resource ${i + 1} label`}
                placeholder="Label"
                value={r.label}
                onChange={(e) =>
                  setResources((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  )
                }
                className="w-48"
              />
              <Input
                aria-label={`Resource ${i + 1} link`}
                placeholder="https://…"
                value={r.url}
                onChange={(e) =>
                  setResources((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                  )
                }
                className="min-w-[220px] flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setResources((prev) => prev.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
          {resources.length < 10 ? (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResources((prev) => [...prev, { label: "", url: "" }])}
              >
                Add link
              </Button>
            </div>
          ) : null}
        </div>
      </Section>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="question-tags">Tags (comma-separated)</Label>
        <Input
          id="question-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. rotation, uceed-2023"
        />
      </div>

      <FieldError>{error}</FieldError>
      {saved ? (
        <p role="status" className="text-sm text-success-600 dark:text-success-400">
          Saved.
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save question" : "Create question"}
        </Button>
      </div>
    </form>
  );
}
