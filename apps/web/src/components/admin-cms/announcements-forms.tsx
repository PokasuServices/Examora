"use client";

import * as React from "react";
import type { CmsAnnouncementDto } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";

export function AnnouncementCreateForm({
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  error: string | null;
  onSubmit: (input: { title: string; body: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, body });
      }}
      className="flex flex-col gap-4 rounded-md border border-neutral-100 bg-neutral-50/50 p-4"
    >
      <h3 className="font-heading text-sm font-semibold text-neutral-900">New announcement</h3>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="announcement-title">Title</Label>
        <Input
          id="announcement-title"
          required
          maxLength={300}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="announcement-body">Body</Label>
        <textarea
          id="announcement-body"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        />
      </div>
      <FieldError>{error}</FieldError>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || !title.trim() || !body.trim()}>
          {submitting ? "Creating…" : "Create announcement"}
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

export function AnnouncementFieldsForm({
  item,
  editable,
  submitting,
  error,
  onSave,
}: {
  item: CmsAnnouncementDto;
  editable: boolean;
  submitting: boolean;
  error: string | null;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = React.useState(item.title);
  const [body, setBody] = React.useState(item.body);

  React.useEffect(() => {
    setTitle(item.title);
    setBody(item.body);
  }, [item]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ title, body });
      }}
      className="flex flex-col gap-4"
    >
      {!editable ? (
        <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
          Only content in Draft can be edited — send it back to draft first.
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="announcement-edit-title">Title</Label>
        <Input
          id="announcement-edit-title"
          disabled={!editable}
          maxLength={300}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="announcement-edit-body">Body</Label>
        <textarea
          id="announcement-edit-body"
          disabled={!editable}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:bg-neutral-50 disabled:text-neutral-500"
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
