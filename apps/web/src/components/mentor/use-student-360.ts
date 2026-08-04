"use client";

import * as React from "react";
import type {
  MentorFeedback,
  MentorMeeting,
  MentorNote,
  MentorTask,
  Student360,
} from "@examora/types";
import { useMentorApi } from "@/lib/mentor-api";

type LoadState = "loading" | "ready" | "not-found";

/**
 * Owns every piece of Student 360: the aggregated 360 view plus the four
 * mentor-workflow CRUD lists (notes/tasks/feedback/meetings), all scoped to
 * one studentId. Mutations re-fetch only their own list, not the whole page.
 */
export function useStudent360(studentId: string) {
  const api = useMentorApi();

  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [student360, setStudent360] = React.useState<Student360 | null>(null);
  const [notes, setNotes] = React.useState<MentorNote[]>([]);
  const [tasks, setTasks] = React.useState<MentorTask[]>([]);
  const [feedback, setFeedback] = React.useState<MentorFeedback[]>([]);
  const [meetings, setMeetings] = React.useState<MentorMeeting[]>([]);

  const load = React.useCallback(() => {
    setLoadState("loading");
    api
      .getStudent360(studentId)
      .then((s) => {
        setStudent360(s);
        setLoadState("ready");
      })
      .catch(() => setLoadState("not-found"));
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
    // api (useMentorApi()) is a fresh object every render — never put it or
    // any of its methods in a dependency array (see use-mentor-students.ts).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function createNote(body: string): Promise<void> {
    await api.createNote(studentId, body);
    setNotes(await api.listNotes(studentId));
  }
  async function updateNote(noteId: string, body: string): Promise<void> {
    await api.updateNote(studentId, noteId, body);
    setNotes(await api.listNotes(studentId));
  }
  async function deleteNote(noteId: string): Promise<void> {
    await api.deleteNote(studentId, noteId);
    setNotes(await api.listNotes(studentId));
  }

  async function createTask(input: {
    title: string;
    description?: string;
    dueDate?: string;
  }): Promise<void> {
    await api.createTask(studentId, input);
    setTasks(await api.listTasks(studentId));
  }
  async function updateTaskStatus(taskId: string, status: MentorTask["status"]): Promise<void> {
    await api.updateTask(studentId, taskId, { status });
    setTasks(await api.listTasks(studentId));
  }
  async function deleteTask(taskId: string): Promise<void> {
    await api.deleteTask(studentId, taskId);
    setTasks(await api.listTasks(studentId));
  }

  async function createFeedback(body: string): Promise<void> {
    await api.createFeedback(studentId, body);
    setFeedback(await api.listFeedback(studentId));
  }

  async function createMeeting(input: {
    occurredAt: string;
    durationMinutes?: number;
    summary?: string;
  }): Promise<void> {
    await api.createMeeting(studentId, input);
    setMeetings(await api.listMeetings(studentId));
  }

  return {
    loadState,
    student360,
    notes,
    tasks,
    feedback,
    meetings,
    retry: load,
    createNote,
    updateNote,
    deleteNote,
    createTask,
    updateTaskStatus,
    deleteTask,
    createFeedback,
    createMeeting,
  };
}
