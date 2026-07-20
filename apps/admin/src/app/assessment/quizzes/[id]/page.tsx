"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@examora/auth-client";
import type { ContentStatus, Question, QuizDetail, QuizResultDashboard } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { StatusActions } from "@/components/status-actions";
import { StatusBadge } from "@/components/status-badge";
import { useAssessmentApi } from "@/lib/assessment-api";

function QuizDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useAssessmentApi();
  const [quiz, setQuiz] = React.useState<QuizDetail | null>(null);
  const [publishedQuestions, setPublishedQuestions] = React.useState<Question[]>([]);
  const [dashboard, setDashboard] = React.useState<QuizResultDashboard | null>(null);
  const [sectionTitle, setSectionTitle] = React.useState("");
  const [selectedQuestionId, setSelectedQuestionId] = React.useState("");
  const [selectedSectionId, setSelectedSectionId] = React.useState("");
  const [marks, setMarks] = React.useState("1");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .getQuiz(id)
      .then(setQuiz)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    api
      .getResultDashboard(id)
      .then(setDashboard)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    api
      .listQuestions({ status: "PUBLISHED" })
      .then((res) => setPublishedQuestions(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeStatus(status: ContentStatus): Promise<void> {
    setError(null);
    try {
      await api.setQuizStatus(id, status);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status change failed");
    }
  }

  async function addSection(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.createSection(id, { title: sectionTitle });
      setSectionTitle("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add section");
    }
  }

  async function removeSection(sectionId: string): Promise<void> {
    setError(null);
    try {
      await api.deleteSection(id, sectionId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove section");
    }
  }

  async function assignQuestion(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!selectedQuestionId) {
      setError("Choose a question to assign");
      return;
    }
    try {
      await api.assignQuestion(id, {
        questionId: selectedQuestionId,
        sectionId: selectedSectionId || undefined,
        marks: Number(marks),
      });
      setSelectedQuestionId("");
      setMarks("1");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign question");
    }
  }

  async function unassign(assignmentId: string): Promise<void> {
    setError(null);
    try {
      await api.unassignQuestion(id, assignmentId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not unassign question");
    }
  }

  if (!quiz) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
        <FieldError>{error}</FieldError>
      </main>
    );
  }

  const assignableQuestions = publishedQuestions.filter(
    (q) => !quiz.questions.some((assigned) => assigned.questionId === q.id),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/assessment/quizzes" className="hover:underline">
          Quizzes
        </Link>{" "}
        · <span className="text-neutral-800">{quiz.title}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-heading">{quiz.title}</h1>
          <StatusBadge status={quiz.status} />
        </div>
        <StatusActions status={quiz.status} onChange={(s) => void changeStatus(s)} />
      </div>

      <p className="mt-2 text-sm text-neutral-500">
        {quiz.totalQuestions} question{quiz.totalQuestions === 1 ? "" : "s"} · {quiz.totalMarks}{" "}
        marks · {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "Untimed"} · Pass at{" "}
        {quiz.passingScorePercent}%
      </p>
      <FieldError>{error}</FieldError>

      {dashboard ? (
        <section className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-neutral-200 bg-white p-6 text-sm sm:grid-cols-4">
          <div>
            <p className="text-neutral-500">Total attempts</p>
            <p className="text-lg font-semibold">{dashboard.totalAttempts}</p>
          </div>
          <div>
            <p className="text-neutral-500">Completed</p>
            <p className="text-lg font-semibold">{dashboard.completedAttempts}</p>
          </div>
          <div>
            <p className="text-neutral-500">Pass rate</p>
            <p className="text-lg font-semibold">
              {dashboard.passRate !== null ? `${dashboard.passRate}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-neutral-500">Average score</p>
            <p className="text-lg font-semibold">
              {dashboard.averagePercentage !== null ? `${dashboard.averagePercentage}%` : "—"}
            </p>
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Sections</h2>
        <form onSubmit={addSection} className="mt-3 flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sectionTitle">New section title</Label>
            <Input
              id="sectionTitle"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!sectionTitle}>
            Add section
          </Button>
        </form>
        {quiz.sections.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100">
            {quiz.sections.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                {s.title}
                <Button variant="ghost" onClick={() => void removeSection(s.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">
            No sections yet — questions can still be assigned unsectioned.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Assigned questions</h2>
        <form onSubmit={assignQuestion} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="question">Published question</Label>
            <select
              id="question"
              className="h-10 w-64 rounded-md border border-neutral-300 px-3 text-sm"
              value={selectedQuestionId}
              onChange={(e) => setSelectedQuestionId(e.target.value)}
            >
              <option value="">— choose —</option>
              {assignableQuestions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.text.slice(0, 60)}
                </option>
              ))}
            </select>
          </div>
          {quiz.sections.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="section">Section</Label>
              <select
                id="section"
                className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
              >
                <option value="">— none —</option>
                {quiz.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marks">Marks</Label>
            <Input
              id="marks"
              type="number"
              min={0.01}
              step={0.5}
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              className="w-24"
            />
          </div>
          <Button type="submit">Assign</Button>
        </form>

        {quiz.questions.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100">
            {quiz.questions.map((assignment) => (
              <li key={assignment.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {assignment.question.text.slice(0, 80)}{" "}
                  <span className="text-neutral-400">({assignment.marks} marks)</span>
                </span>
                <Button variant="ghost" onClick={() => void unassign(assignment.id)}>
                  Unassign
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">
            No questions assigned yet — a quiz needs at least one PUBLISHED question assigned before
            it can be published.
          </p>
        )}
      </section>
    </main>
  );
}

export default function QuizDetailPage() {
  return (
    <RequirePermission permission="quiz:manage">
      <QuizDetailContent />
    </RequirePermission>
  );
}
