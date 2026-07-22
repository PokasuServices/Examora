"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@examora/auth-client";
import type {
  MentorFeedback,
  MentorMeeting,
  MentorNote,
  MentorTask,
  Student360,
} from "@examora/types";
import { Button, FieldError, Input } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useMentorApi } from "@/lib/mentor-api";

function Student360Content() {
  const { id: studentId } = useParams<{ id: string }>();
  const api = useMentorApi();
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

  const load = React.useCallback(() => {
    api
      .getStudent360(studentId)
      .then(setStudent360)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load"));
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

  async function removeNote(noteId: string): Promise<void> {
    try {
      await api.deleteNote(studentId, noteId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove note");
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

  async function toggleTask(task: MentorTask): Promise<void> {
    try {
      await api.updateTaskStatus(
        studentId,
        task.id,
        task.status === "COMPLETED" ? "PENDING" : "COMPLETED",
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update task");
    }
  }

  async function removeTask(taskId: string): Promise<void> {
    try {
      await api.deleteTask(studentId, taskId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove task");
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

  if (!student360) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
        <FieldError>{error}</FieldError>
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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">
          {[profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email}
        </h1>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm">{profile.status}</span>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        {profile.email} · Mentor: {currentMentor?.email ?? "Unassigned"}
      </p>
      <FieldError>{error}</FieldError>

      <section className="mt-6 grid grid-cols-3 gap-4 rounded-lg border border-neutral-200 bg-white p-6 text-sm">
        <div>
          <p className="text-neutral-500">Courses started</p>
          <p className="text-lg font-semibold">{learningProgress.stats.coursesStarted}</p>
        </div>
        <div>
          <p className="text-neutral-500">Courses completed</p>
          <p className="text-lg font-semibold">{learningProgress.stats.coursesCompleted}</p>
        </div>
        <div>
          <p className="text-neutral-500">Lessons completed</p>
          <p className="text-lg font-semibold">{learningProgress.stats.lessonsCompleted}</p>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Quiz history</h2>
        {quizHistory.length > 0 ? (
          <ul className="mt-3 divide-y divide-neutral-100">
            {quizHistory.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span>{a.quizTitle}</span>
                <span className="text-neutral-500">
                  {a.percentage !== null ? `${a.percentage}%` : a.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No quiz attempts yet.</p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Assignment history</h2>
        {assignmentHistory.length > 0 ? (
          <ul className="mt-3 divide-y divide-neutral-100">
            {assignmentHistory.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {s.assignmentTitle} <span className="text-neutral-400">v{s.version}</span>
                </span>
                <span className="text-neutral-500">{s.decision ?? s.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No assignment submissions yet.</p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Activity timeline</h2>
        {activityTimeline.length > 0 ? (
          <ul className="mt-3 divide-y divide-neutral-100">
            {activityTimeline.slice(0, 15).map((item, i) => (
              <li key={i} className="py-2 text-sm">
                <p>{item.title}</p>
                <p className="text-xs text-neutral-400">
                  {new Date(item.occurredAt).toLocaleString()}
                  {item.description ? ` · ${item.description}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No activity yet.</p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Private notes</h2>
        <p className="mt-1 text-xs text-neutral-400">Never visible to the student.</p>
        {notes.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 text-sm">
                <span>{n.body}</span>
                <Button variant="ghost" onClick={() => void removeNote(n.id)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <form onSubmit={addNote} className="mt-3 flex items-end gap-3">
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
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Tasks</h2>
        {tasks.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                <span className={t.status === "COMPLETED" ? "text-neutral-400 line-through" : ""}>
                  {t.title}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => void toggleTask(t)}>
                    {t.status === "COMPLETED" ? "Reopen" : "Complete"}
                  </Button>
                  <Button variant="ghost" onClick={() => void removeTask(t.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <form onSubmit={addTask} className="mt-3 flex items-end gap-3">
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
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Feedback</h2>
        {feedback.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {feedback.map((f) => (
              <li key={f.id} className="text-sm">
                <p>{f.body}</p>
                <p className="text-xs text-neutral-400">{new Date(f.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <form onSubmit={addFeedback} className="mt-3 flex items-end gap-3">
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
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Meeting history</h2>
        {meetings.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {meetings.map((m) => (
              <li key={m.id} className="text-sm">
                <p>{new Date(m.occurredAt).toLocaleString()}</p>
                {m.summary ? <p className="text-neutral-500">{m.summary}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
        <form onSubmit={logMeeting} className="mt-3 flex items-end gap-3">
          <Input
            placeholder="Meeting summary (logs a meeting now)"
            value={meetingSummary}
            onChange={(e) => setMeetingSummary(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">Log meeting</Button>
        </form>
      </section>
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
