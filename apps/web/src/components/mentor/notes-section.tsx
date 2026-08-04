"use client";

import * as React from "react";
import { FileText, Pencil, Trash2 } from "lucide-react";
import type { MentorNote } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Plain create/edit/delete, not autosave — MentorNote is a discrete
 * timeline entry created via an explicit action (CreateNoteDto/UpdateNoteDto
 * only accept a full `body` string on save), unlike the Assignment
 * Workspace's single continuously-edited notes field. There's no
 * "draft in progress" concept here to autosave.
 */
export function NotesSection({
  notes,
  onCreate,
  onUpdate,
  onDelete,
}: {
  notes: MentorNote[];
  onCreate: (body: string) => Promise<void>;
  onUpdate: (noteId: string, body: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onCreate(draft.trim());
      setDraft("");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(noteId: string) {
    if (!editValue.trim()) return;
    await onUpdate(noteId, editValue.trim());
    setEditingId(null);
  }

  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section aria-labelledby="notes-heading">
      <h2 id="notes-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Mentor Notes
      </h2>
      <Card className="mt-3">
        <form onSubmit={handleCreate} className="flex flex-col gap-2">
          <label htmlFor="new-note" className="sr-only">
            Add a private note
          </label>
          <textarea
            id="new-note"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Private note — only you can see this"
            className="min-h-20 w-full rounded-md border border-neutral-200 p-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="flex h-9 w-fit items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add note"}
          </button>
        </form>

        <div className="mt-4 border-t border-neutral-100 pt-4">
          {sorted.length === 0 ? (
            <EmptyState icon={FileText} heading="No notes yet" />
          ) : (
            <ul className="flex flex-col gap-3">
              {sorted.map((note) => (
                <li key={note.id} className="rounded-md bg-neutral-50 p-3">
                  {editingId === note.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="min-h-20 w-full rounded-md border border-neutral-200 bg-white p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(note.id)}
                          className="text-xs font-medium text-primary-600 hover:underline"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-xs font-medium text-neutral-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-pre-wrap text-sm text-neutral-700">{note.body}</p>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(note.id);
                              setEditValue(note.body);
                            }}
                            aria-label="Edit note"
                            className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
                          >
                            <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDelete(note.id)}
                            aria-label="Delete note"
                            className="rounded p-1 text-neutral-400 hover:bg-danger-50 hover:text-danger-600"
                          >
                            <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-neutral-400">
                        {new Date(note.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </section>
  );
}
