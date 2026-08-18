"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  CalendarClock,
  CheckSquare,
  ClipboardCheck,
  FileStack,
  MessageSquare,
  StickyNote,
} from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type {
  MentorFeedback,
  MentorMeeting,
  MentorNote,
  MentorTask,
  MentorTaskStatus,
  Student360,
  UserStatus,
} from "@examora/types";
import { Button, FieldError, Input } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useMentorApi } from "@/lib/mentor-api";

const STATUS_TONE: Record<UserStatus, ChipTone> = {
  ACTIVE: "success",
  PENDING_VERIFICATION: "warning",
  INACTIVE: "neutral",
  SUSPENDED: "danger",
  ARCHIVED: "neutral",
};

const TASK_STATUS_TONE: Record<MentorTaskStatus, ChipTone> = {
  PENDING: "neutral",
  IN_PROGRESS: "primary",
  COMPLETED: "success",
};

// Covers both quiz attempt statuses (IN_PROGRESS/SUBMITTED/AUTO_SUBMITTED) and, below,
// assignment submission statuses / review decisions — kept loose since both feed the
// same generic Chip rendering and neither type is otherwise needed in this file.
const QUIZ_STATUS_TONE: Record<string, ChipTone> = {
  IN_PROGRESS: "warning",
  SUBMITTED: "success",
  AUTO_SUBMITTED: "neutral",
};

const ASSIGNMENT_STATUS_TONE: Record<string, ChipTone> = {
  DRAFT: "neutral",
  SUBMITTED: "primary",
  UNDER_REVIEW: "warning",
  REVISION_REQUESTED: "danger",
  APPROVED: "success",
};

type PendingAction =
  | { kind: "delete-note"; note: MentorNote }
  | { kind: "delete-task"; task: MentorTask }
  | { kind: "toggle-task"; task: MentorTask }
  | null;

function Student360Content() {
  const { id: studentId } = useParams<{ id: string }>();
  const api = useMentorApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [student360, setStudent360] = React.useState<Student360 | null>(null);
  const [notes, setNotes] = React.useState<MentorNote[]>([]);
  const [tasks, setTasks] = React.useState<MentorTask[]>([]);
  const [feedback, setFeedback] = React.useState<MentorFeedback[]>([]);
  const [meetings, setMeetings] = React.useState<MentorMeeting[]>([]);
  const [noteBody, setNoteBody] = React.useState("");
  const [taskTitle, setTaskTitle] = React.useState("");
  const [feedbackBody, setFeedbackBody] = React.useState("");
  const [meetingSummary, setMeetingSummary] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<PendingAction>(null);
  const [actionSubmitting, setActionSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getStudent360(studentId)
      .then((data) => {
        setStudent360(data);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Failed to load");
        setStatus("error");
      });
    api
      .listNotes(studentId)
      .then(setNotes)
      .catch(() => undefined);
    api
      .listTasks(studentId)
      .then(setTasks)
      .catch(() => undefined);
    api
      .listFeedback(studentId)
      .then(setFeedback)
      .catch(() => undefined);
    api
      .listMeetings(studentId)
      .then(setMeetings)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function addNote(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!noteBody.trim()) return;
    try {
      await api.addNote(studentId, noteBody);
      setNoteBody("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add note");
    }
  }

  async function addTask(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      await api.addTask(studentId, { title: taskTitle });
      setTaskTitle("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add task");
    }
  }

  async function addFeedback(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!feedbackBody.trim()) return;
    try {
      await api.addFeedback(studentId, feedbackBody);
      setFeedbackBody("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not share feedback");
    }
  }

  async function logMeeting(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await api.addMeeting(studentId, {
        occurredAt: new Date().toISOString(),
        summary: meetingSummary || undefined,
      });
      setMeetingSummary("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log meeting");
    }
  }

  async function confirmPendingAction(): Promise<void> {
    if (!pendingAction) return;
    setError(null);
    setActionSubmitting(true);
    try {
      if (pendingAction.kind === "delete-note") {
        await api.deleteNote(studentId, pendingAction.note.id);
      } else if (pendingAction.kind === "delete-task") {
        await api.deleteTask(studentId, pendingAction.task.id);
      } else {
        await api.updateTaskStatus(
          studentId,
          pendingAction.task.id,
          pendingAction.task.status === "COMPLETED" ? "PENDING" : "COMPLETED",
        );
      }
      setPendingAction(null);
      load();
    } catch (err) {
      const fallback =
        pendingAction.kind === "delete-note"
          ? "Could not remove note"
          : pendingAction.kind === "delete-task"
            ? "Could not remove task"
            : "Could not update task";
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setActionSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-64" />
        <Card>
          <Skeleton className="h-24 w-full" />
        </Card>
        <Card>
          <Skeleton className="h-24 w-full" />
        </Card>
      </main>
    );
  }

  if (status === "error" || !student360) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load this student" onRetry={load} />
        </Card>
      </main>
    );
  }

  const {
    profile,
    currentMentor,
    learningProgress,
    quizHistory,
    assignmentHistory,
    activityTimeline,
  } = student360;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={[profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email}
        subtitle={`${profile.email} · Mentor: ${currentMentor?.email ?? "Unassigned"}`}
        actions={<Chip tone={STATUS_TONE[profile.status]}>{statusLabel(profile.status)}</Chip>}
      />

      <FieldError>{error}</FieldError>

      <Card>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-neutral-500">Courses started</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              {learningProgress.stats.coursesStarted}
            </p>
          </div>
          <div>
            <p className="text-neutral-500">Courses completed</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              {learningProgress.stats.coursesCompleted}
            </p>
          </div>
          <div>
            <p className="text-neutral-500">Lessons completed</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              {learningProgress.stats.lessonsCompleted}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Quiz history</h2>
        {quizHistory.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100">
            {quizHistory.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-neutral-700">{a.quizTitle}</span>
                {a.percentage !== null ? (
                  <span className="font-medium text-neutral-600">{a.percentage}%</span>
                ) : (
                  <Chip tone={QUIZ_STATUS_TONE[a.status] ?? "neutral"}>
                    {statusLabel(a.status)}
                  </Chip>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={ClipboardCheck} heading="No quiz attempts yet" />
        )}
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">
          Assignment history
        </h2>
        {assignmentHistory.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100">
            {assignmentHistory.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-neutral-700">
                  {s.assignmentTitle} <span className="text-neutral-400">v{s.version}</span>
                </span>
                <Chip tone={ASSIGNMENT_STATUS_TONE[s.decision ?? s.status] ?? "neutral"}>
                  {statusLabel(s.decision ?? s.status)}
                </Chip>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={FileStack} heading="No assignment submissions yet" />
        )}
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Activity timeline</h2>
        {activityTimeline.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100">
            {activityTimeline.slice(0, 15).map((item, i) => (
              <li key={i} className="py-2.5 text-sm">
                <p className="text-neutral-700">{item.title}</p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {new Date(item.occurredAt).toLocaleString()}
                  {item.description ? ` · ${item.description}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Activity} heading="No activity yet" />
        )}
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Private notes</h2>
        <p className="mt-1 text-xs text-neutral-400">Never visible to the student.</p>
        {notes.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-neutral-700">{n.body}</span>
                <Button
                  variant="ghost"
                  onClick={() => setPendingAction({ kind: "delete-note", note: n })}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={StickyNote} heading="No notes yet" />
        )}
        <form onSubmit={addNote} className="mt-4 flex items-end gap-3">
          <Input
            placeholder="Add a private note"
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!noteBody.trim()}>
            Add
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Tasks</h2>
        {tasks.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span
                  className={
                    t.status === "COMPLETED" ? "text-neutral-400 line-through" : "text-neutral-700"
                  }
                >
                  {t.title}
                </span>
                <div className="flex items-center gap-2">
                  <Chip tone={TASK_STATUS_TONE[t.status]}>{statusLabel(t.status)}</Chip>
                  <Button
                    variant="ghost"
                    onClick={() => setPendingAction({ kind: "toggle-task", task: t })}
                  >
                    {t.status === "COMPLETED" ? "Reopen" : "Complete"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setPendingAction({ kind: "delete-task", task: t })}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CheckSquare} heading="No tasks yet" />
        )}
        <form onSubmit={addTask} className="mt-4 flex items-end gap-3">
          <Input
            placeholder="New task title"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!taskTitle.trim()}>
            Assign task
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Feedback</h2>
        {feedback.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {feedback.map((f) => (
              <li key={f.id} className="text-sm">
                <p className="text-neutral-700">{f.body}</p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {new Date(f.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={MessageSquare} heading="No feedback yet" />
        )}
        <form onSubmit={addFeedback} className="mt-4 flex items-end gap-3">
          <Input
            placeholder="Share feedback with the student"
            value={feedbackBody}
            onChange={(e) => setFeedbackBody(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!feedbackBody.trim()}>
            Share
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Meeting history</h2>
        {meetings.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {meetings.map((m) => (
              <li key={m.id} className="text-sm">
                <p className="text-neutral-700">{new Date(m.occurredAt).toLocaleString()}</p>
                {m.summary ? <p className="mt-0.5 text-neutral-500">{m.summary}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarClock} heading="No meetings logged yet" />
        )}
        <form onSubmit={logMeeting} className="mt-4 flex items-end gap-3">
          <Input
            placeholder="Meeting summary (logs a meeting now)"
            value={meetingSummary}
            onChange={(e) => setMeetingSummary(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">Log meeting</Button>
        </form>
      </Card>

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.kind === "delete-note"
            ? "Delete this note?"
            : pendingAction?.kind === "delete-task"
              ? "Delete this task?"
              : pendingAction?.kind === "toggle-task"
                ? pendingAction.task.status === "COMPLETED"
                  ? "Reopen this task?"
                  : "Mark task complete?"
                : ""
        }
        message={
          pendingAction?.kind === "delete-note"
            ? "This removes the note permanently."
            : pendingAction?.kind === "delete-task"
              ? "This removes the task permanently."
              : pendingAction?.kind === "toggle-task"
                ? pendingAction.task.status === "COMPLETED"
                  ? "The task will be reopened as pending."
                  : "The task will be marked complete."
                : ""
        }
        confirmLabel={
          pendingAction?.kind === "delete-note" || pendingAction?.kind === "delete-task"
            ? "Delete"
            : pendingAction?.kind === "toggle-task"
              ? pendingAction.task.status === "COMPLETED"
                ? "Reopen"
                : "Complete"
              : "Confirm"
        }
        tone={
          pendingAction?.kind === "delete-note" || pendingAction?.kind === "delete-task"
            ? "danger"
            : "primary"
        }
        submitting={actionSubmitting}
        error={error}
        onConfirm={() => void confirmPendingAction()}
        onCancel={() => setPendingAction(null)}
      />
    </main>
  );
}

export default function Student360Page() {
  return (
    <RequirePermission permission="mentor:workflow">
      <Student360Content />
    </RequirePermission>
  );
}
