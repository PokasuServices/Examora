"use client";

import * as React from "react";
import type { Category, Course } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { SelectField } from "@/components/ui/select-field";
import { ContentStatusActions } from "./content-status-actions";

export function CourseDetailPanel({
  course,
  categories,
  mutationStatus,
  mutationError,
  onSave,
  onStatusChange,
}: {
  course: Course;
  categories: Category[];
  mutationStatus: "idle" | "submitting" | "error";
  mutationError: string | null;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
  onStatusChange: (status: Course["status"]) => Promise<boolean>;
}) {
  const [title, setTitle] = React.useState(course.title);
  const [description, setDescription] = React.useState(course.description ?? "");
  const [examType, setExamType] = React.useState(course.examType ?? "");
  const [categoryId, setCategoryId] = React.useState(course.categoryId ?? "");
  const [priceAmount, setPriceAmount] = React.useState(
    course.priceAmount !== null ? String(course.priceAmount) : "",
  );

  React.useEffect(() => {
    setTitle(course.title);
    setDescription(course.description ?? "");
    setExamType(course.examType ?? "");
    setCategoryId(course.categoryId ?? "");
    setPriceAmount(course.priceAmount !== null ? String(course.priceAmount) : "");
  }, [course]);

  const categoryOptions = [
    { value: "", label: "No category" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <ContentStatusActions
        status={course.status}
        mutationStatus={mutationStatus}
        mutationError={mutationError}
        onChange={onStatusChange}
        entityLabel="course"
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            title,
            description: description || undefined,
            examType: examType || undefined,
            categoryId: categoryId || undefined,
            ...(priceAmount ? { priceAmount: Number(priceAmount) } : { isFree: true }),
          });
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="course-edit-title">Title</Label>
            <Input
              id="course-edit-title"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <SelectField
            id="course-edit-category"
            label="Category"
            value={categoryId}
            options={categoryOptions}
            onChange={setCategoryId}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="course-edit-exam-type">Exam type</Label>
            <Input
              id="course-edit-exam-type"
              maxLength={60}
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="course-edit-price">
              Price ({course.priceCurrency}) — blank means free
            </Label>
            <Input
              id="course-edit-price"
              type="number"
              min={0}
              step="0.01"
              value={priceAmount}
              onChange={(e) => setPriceAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="course-edit-description">Description</Label>
          <textarea
            id="course-edit-description"
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          />
        </div>
        <FieldError>{mutationError}</FieldError>
        <div>
          <Button type="submit" disabled={mutationStatus === "submitting"}>
            {mutationStatus === "submitting" ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
