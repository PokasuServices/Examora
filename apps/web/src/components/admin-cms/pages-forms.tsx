"use client";

import * as React from "react";
import { CMS_PAGE_TYPES, type CmsPageDto, type CmsPageType } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { SelectField } from "@/components/ui/select-field";

export function PageCreateForm({
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  error: string | null;
  onSubmit: (input: { pageType: CmsPageType; slug: string; title: string; body: string }) => void;
  onCancel: () => void;
}) {
  const [pageType, setPageType] = React.useState<CmsPageType>("STATIC");
  const [slug, setSlug] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ pageType, slug, title, body });
      }}
      className="flex flex-col gap-4 rounded-md border border-neutral-100 bg-neutral-50/50 p-4"
    >
      <h3 className="font-heading text-sm font-semibold text-neutral-900">New page</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          id="page-type"
          label="Page type"
          value={pageType}
          options={CMS_PAGE_TYPES.map((t) => ({ value: t, label: t }))}
          onChange={(v) => setPageType(v as CmsPageType)}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-slug">Slug</Label>
          <Input
            id="page-slug"
            required
            maxLength={200}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-title">Title</Label>
          <Input
            id="page-title"
            required
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="page-body">Body</Label>
        <textarea
          id="page-body"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        />
      </div>
      <FieldError>{error}</FieldError>
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={submitting || !slug.trim() || !title.trim() || !body.trim()}
        >
          {submitting ? "Creating…" : "Create page"}
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

export function PageFieldsForm({
  page,
  editable,
  submitting,
  error,
  onSave,
}: {
  page: CmsPageDto;
  editable: boolean;
  submitting: boolean;
  error: string | null;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = React.useState(page.title);
  const [body, setBody] = React.useState(page.body);
  const [seoTitle, setSeoTitle] = React.useState(page.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = React.useState(page.seoDescription ?? "");

  React.useEffect(() => {
    setTitle(page.title);
    setBody(page.body);
    setSeoTitle(page.seoTitle ?? "");
    setSeoDescription(page.seoDescription ?? "");
  }, [page]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          title,
          body,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
        });
      }}
      className="flex flex-col gap-4"
    >
      {!editable ? (
        <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
          Only content in Draft can be edited — send it back to draft first.
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="page-edit-title">Title</Label>
        <Input
          id="page-edit-title"
          disabled={!editable}
          maxLength={300}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="page-edit-body">Body</Label>
        <textarea
          id="page-edit-body"
          disabled={!editable}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:bg-neutral-50 disabled:text-neutral-500"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-edit-seo-title">SEO title</Label>
          <Input
            id="page-edit-seo-title"
            disabled={!editable}
            maxLength={300}
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="page-edit-seo-description">SEO description</Label>
          <Input
            id="page-edit-seo-description"
            disabled={!editable}
            maxLength={500}
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
          />
        </div>
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
