"use client";

import * as React from "react";
import type { CmsFaqItemDto } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";

export function FaqCreateForm({
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  error: string | null;
  onSubmit: (input: { question: string; answer: string; category?: string }) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [category, setCategory] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ question, answer, category: category || undefined });
      }}
      className="flex flex-col gap-4 rounded-md border border-neutral-100 bg-neutral-50/50 p-4"
    >
      <h3 className="font-heading text-sm font-semibold text-neutral-900">New FAQ item</h3>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="faq-question">Question</Label>
        <Input
          id="faq-question"
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="faq-answer">Answer</Label>
        <textarea
          id="faq-answer"
          required
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="faq-category">Category</Label>
        <Input id="faq-category" value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <FieldError>{error}</FieldError>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || !question.trim() || !answer.trim()}>
          {submitting ? "Creating…" : "Create FAQ item"}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-neutral-600 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function FaqFieldsForm({
  item,
  editable,
  submitting,
  error,
  onSave,
}: {
  item: CmsFaqItemDto;
  editable: boolean;
  submitting: boolean;
  error: string | null;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const [question, setQuestion] = React.useState(item.question);
  const [answer, setAnswer] = React.useState(item.answer);
  const [category, setCategory] = React.useState(item.category ?? "");

  React.useEffect(() => {
    setQuestion(item.question);
    setAnswer(item.answer);
    setCategory(item.category ?? "");
  }, [item]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ question, answer, category: category || undefined });
      }}
      className="flex flex-col gap-4"
    >
      {!editable ? (
        <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
          Only content in Draft can be edited — send it back to draft first.
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="faq-edit-question">Question</Label>
        <Input
          id="faq-edit-question"
          disabled={!editable}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="faq-edit-answer">Answer</Label>
        <textarea
          id="faq-edit-answer"
          disabled={!editable}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:bg-neutral-50 disabled:text-neutral-500"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="faq-edit-category">Category</Label>
        <Input
          id="faq-edit-category"
          disabled={!editable}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>
      <FieldError>{error}</FieldError>
      {editable ? (
        <div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
