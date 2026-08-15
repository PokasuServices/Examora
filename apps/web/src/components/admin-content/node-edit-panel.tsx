"use client";

import * as React from "react";
import type { Module, Subject, Topic } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ContentStatusActions } from "./content-status-actions";
import type { NodeCollection } from "./use-course-editor";

const COLLECTION_LABEL: Record<"subjects" | "topics" | "modules", string> = {
  subjects: "Subject",
  topics: "Topic",
  modules: "Module",
};

type EditableNode = Subject | Topic | Module;

export function NodeEditPanel({
  collection,
  node,
  siblingIndex,
  siblingCount,
  mutationStatus,
  mutationError,
  onSave,
  onStatusChange,
  onDelete,
  onMove,
}: {
  collection: "subjects" | "topics" | "modules";
  node: EditableNode;
  siblingIndex: number;
  siblingCount: number;
  mutationStatus: "idle" | "submitting" | "error";
  mutationError: string | null;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
  onStatusChange: (status: EditableNode["status"]) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onMove: (direction: "up" | "down") => void;
}) {
  const [title, setTitle] = React.useState(node.title);
  const [slug, setSlug] = React.useState(node.slug);
  const [description, setDescription] = React.useState(node.description ?? "");
  const [type, setType] = React.useState(
    collection === "modules" ? ((node as Module).type ?? "") : "",
  );
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    setTitle(node.title);
    setSlug(node.slug);
    setDescription(node.description ?? "");
    setType(collection === "modules" ? ((node as Module).type ?? "") : "");
  }, [node, collection]);

  async function handleDelete(): Promise<void> {
    const ok = await onDelete();
    if (ok) setConfirmDelete(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <ContentStatusActions
          status={node.status}
          mutationStatus={mutationStatus}
          mutationError={mutationError}
          onChange={onStatusChange}
          entityLabel={COLLECTION_LABEL[collection].toLowerCase()}
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Move up"
            disabled={siblingIndex === 0}
            onClick={() => onMove("up")}
            className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowUp size={15} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={siblingIndex === siblingCount - 1}
            onClick={() => onMove("down")}
            className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowDown size={15} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${COLLECTION_LABEL[collection].toLowerCase()}`}
            onClick={() => setConfirmDelete(true)}
            className="rounded p-1.5 text-danger-500 hover:bg-danger-50"
          >
            <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            title,
            slug,
            description: description || undefined,
            ...(collection === "modules" ? { type: type || undefined } : {}),
          });
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="node-title">Title</Label>
            <Input
              id="node-title"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="node-slug">Slug</Label>
            <Input id="node-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
        </div>
        {collection === "modules" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="node-type">Type</Label>
            <Input
              id="node-type"
              maxLength={60}
              value={type}
              placeholder="e.g. LEARNING, PRACTICE"
              onChange={(e) => setType(e.target.value)}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="node-description">Description</Label>
          <textarea
            id="node-description"
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
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

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete this ${COLLECTION_LABEL[collection].toLowerCase()}?`}
        message={
          <>
            Delete <span className="font-medium text-neutral-800">{node.title}</span>? This
            can&rsquo;t be undone.
          </>
        }
        confirmLabel="Delete"
        tone="danger"
        submitting={mutationStatus === "submitting"}
        error={mutationError}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export function NodeCreatePanel({
  collection,
  mutationStatus,
  mutationError,
  onCreate,
  onCancel,
}: {
  collection: NodeCollection;
  mutationStatus: "idle" | "submitting" | "error";
  mutationError: string | null;
  onCreate: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const singular: Record<NodeCollection, string> = {
    subjects: "Subject",
    topics: "Topic",
    modules: "Module",
    lessons: "Lesson",
  };
  const [title, setTitle] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCreate({ title });
      }}
      className="flex flex-col gap-4"
    >
      <h3 className="font-heading text-base font-semibold text-neutral-900">
        New {singular[collection]}
      </h3>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-node-title">Title</Label>
        <Input
          id="new-node-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <FieldError>{mutationError}</FieldError>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={mutationStatus === "submitting" || !title.trim()}>
          {mutationStatus === "submitting"
            ? "Creating…"
            : `Create ${singular[collection].toLowerCase()}`}
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
