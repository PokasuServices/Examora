"use client";

import * as React from "react";
import type { Category } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { SelectField } from "@/components/ui/select-field";

export function CourseCreateForm({
  categories,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  categories: Category[];
  submitting: boolean;
  error: string | null;
  onSubmit: (input: {
    title: string;
    categoryId?: string;
    examType?: string;
    description?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [examType, setExamType] = React.useState("");
  const [description, setDescription] = React.useState("");

  const categoryOptions = [
    { value: "", label: "No category" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title,
          categoryId: categoryId || undefined,
          examType: examType || undefined,
          description: description || undefined,
        });
      }}
      className="flex flex-col gap-4 rounded-md border border-neutral-100 bg-neutral-50/50 p-4"
    >
      <h3 className="font-heading text-sm font-semibold text-neutral-900">New course</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="course-title">Title</Label>
          <Input
            id="course-title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <SelectField
          id="course-category"
          label="Category"
          value={categoryId}
          options={categoryOptions}
          onChange={setCategoryId}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="course-exam-type">Exam type</Label>
          <Input
            id="course-exam-type"
            maxLength={60}
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="course-description">Description</Label>
        <textarea
          id="course-description"
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        />
      </div>
      <FieldError>{error}</FieldError>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || !title.trim()}>
          {submitting ? "Creating…" : "Create course"}
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
