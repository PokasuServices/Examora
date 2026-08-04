"use client";

import * as React from "react";
import { ListTodo, Trash2 } from "lucide-react";
import type { MentorTask, MentorTaskStatus } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_LABEL: Record<MentorTaskStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

/** No priority field exists on MentorTask anywhere in the schema/DTOs — omitted rather than invented. */
export function TasksSection({
  tasks,
  onCreate,
  onUpdateStatus,
  onDelete,
}: {
  tasks: MentorTask[];
  onCreate: (input: { title: string; description?: string; dueDate?: string }) => Promise<void>;
  onUpdateStatus: (taskId: string, status: MentorTaskStatus) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}) {
  const [title, setTitle] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate({ title: title.trim(), dueDate: dueDate || undefined });
      setTitle("");
      setDueDate("");
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    if (a.status === "COMPLETED" && b.status !== "COMPLETED") return 1;
    if (a.status !== "COMPLETED" && b.status === "COMPLETED") return -1;
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });

  return (
    <section aria-labelledby="tasks-heading">
      <h2 id="tasks-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Tasks
      </h2>
      <Card className="mt-3">
        <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="task-title" className="sr-only">
              Task title
            </label>
            <input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New task…"
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="task-due" className="sr-only">
              Due date
            </label>
            <input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-10 rounded-md border border-neutral-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="flex h-10 shrink-0 items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
          >
            Add task
          </button>
        </form>

        <div className="mt-4 border-t border-neutral-100 pt-4">
          {sorted.length === 0 ? (
            <EmptyState icon={ListTodo} heading="No tasks yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-100">
              {sorted.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${task.status === "COMPLETED" ? "text-neutral-400 line-through" : "text-neutral-800"}`}
                    >
                      {task.title}
                    </p>
                    {task.dueDate ? (
                      <p className="text-xs text-neutral-400">
                        Due{" "}
                        {new Date(task.dueDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    ) : null}
                  </div>
                  <select
                    aria-label={`Status for ${task.title}`}
                    value={task.status}
                    onChange={(e) =>
                      void onUpdateStatus(task.id, e.target.value as MentorTaskStatus)
                    }
                    className={`h-8 shrink-0 rounded-full border-0 px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      task.status === "COMPLETED"
                        ? "bg-success-50 text-success-700"
                        : task.status === "IN_PROGRESS"
                          ? "bg-warning-50 text-warning-700"
                          : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {(Object.keys(STATUS_LABEL) as MentorTaskStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void onDelete(task.id)}
                    aria-label={`Delete ${task.title}`}
                    className="shrink-0 rounded p-1 text-neutral-400 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </section>
  );
}
