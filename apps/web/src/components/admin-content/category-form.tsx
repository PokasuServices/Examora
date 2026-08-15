"use client";

import * as React from "react";
import type { Category } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";

export function CategoryForm({
  editing,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  editing: Category | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (input: { name: string; slug?: string; description?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState(editing?.name ?? "");
  const [slug, setSlug] = React.useState(editing?.slug ?? "");
  const [description, setDescription] = React.useState(editing?.description ?? "");

  React.useEffect(() => {
    setName(editing?.name ?? "");
    setSlug(editing?.slug ?? "");
    setDescription(editing?.description ?? "");
  }, [editing]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, slug: slug || undefined, description: description || undefined });
      }}
      className="flex flex-col gap-4 rounded-md border border-neutral-100 bg-neutral-50/50 p-4"
    >
      <h3 className="font-heading text-sm font-semibold text-neutral-900">
        {editing ? "Edit category" : "New category"}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-slug">Slug</Label>
          <Input
            id="category-slug"
            maxLength={140}
            value={slug}
            placeholder="auto-generated from name"
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-description">Description</Label>
        <textarea
          id="category-description"
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        />
      </div>
      <FieldError>{error}</FieldError>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? "Saving…" : editing ? "Save changes" : "Create category"}
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
