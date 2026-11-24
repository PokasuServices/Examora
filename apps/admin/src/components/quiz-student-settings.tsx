"use client";

import * as React from "react";
import { ApiError, useAuth } from "@examora/auth-client";
import type { DifficultyLevel, Quiz, QuizDetail, Subject, Topic } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select-field";
import { useAssessmentApi } from "@/lib/assessment-api";
import { useContentApi } from "@/lib/content-api";
import { useStudentAdminApi, type PracticeCategoryRow } from "@/lib/student-admin-api";

/**
 * How the quiz behaves for students (student module redesign): attempts
 * allowed, XP, difficulty label, and the Learn-page topic it belongs to
 * (topic quizzes double their XP on a perfect score; tests have no topic).
 */
export function QuizStudentSettings({ quiz, onSaved }: { quiz: QuizDetail; onSaved: () => void }) {
  const api = useAssessmentApi();
  const content = useContentApi();
  const contentRef = React.useRef(content);
  contentRef.current = content;

  const [maxAttempts, setMaxAttempts] = React.useState(quiz.maxAttempts?.toString() ?? "");
  const [xpReward, setXpReward] = React.useState(String(quiz.xpReward));
  const [level, setLevel] = React.useState<DifficultyLevel | "">(quiz.level ?? "");
  const [topicId, setTopicId] = React.useState(quiz.topicId ?? "");
  const [topics, setTopics] = React.useState<Topic[] | null>(null);
  const [categoryId, setCategoryId] = React.useState(quiz.practiceCategoryId ?? "");
  const [unlockAfterId, setUnlockAfterId] = React.useState(quiz.unlockAfterQuizId ?? "");
  const [requireAllVisited, setRequireAllVisited] = React.useState(quiz.requireAllVisited);
  const [perfectBonusXp, setPerfectBonusXp] = React.useState(String(quiz.perfectBonusXp ?? 0));
  const [exam, setExam] = React.useState(quiz.exam ?? "");
  const [paperYear, setPaperYear] = React.useState(quiz.paperYear?.toString() ?? "");
  const [note, setNote] = React.useState(quiz.note ?? "");
  const [categories, setCategories] = React.useState<PracticeCategoryRow[]>([]);
  const [otherQuizzes, setOtherQuizzes] = React.useState<Quiz[]>([]);
  const { request } = useAuth();
  const studentAdmin = useStudentAdminApi();
  const refs = React.useRef({ request, studentAdmin, api });
  refs.current = { request, studentAdmin, api };

  // Categories come from the quiz's course (via its subject); unlock candidates are the other quizzes.
  React.useEffect(() => {
    const { request: req, studentAdmin: sa, api: a } = refs.current;
    a.listQuizzes()
      .then((res) => setOtherQuizzes(res.items.filter((q) => q.id !== quiz.id)))
      .catch(() => setOtherQuizzes([]));
    if (!quiz.subjectId) return;
    req<Subject>(`/admin/content/subjects/${quiz.subjectId}`, { method: "GET" })
      .then((subject) => sa.categories(subject.courseId))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [quiz.id, quiz.subjectId]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!quiz.subjectId) {
      setTopics([]);
      return;
    }
    contentRef.current
      .listNodes<Topic>("topics", "subjectId", quiz.subjectId)
      .then((res) => setTopics(res.items))
      .catch(() => setTopics([]));
  }, [quiz.subjectId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const attempts = maxAttempts.trim() === "" ? null : Number(maxAttempts);
    const xp = Number(xpReward);
    if (attempts !== null && (!Number.isInteger(attempts) || attempts < 1)) {
      setError("Attempts allowed must be a whole number of 1 or more, or blank for unlimited.");
      return;
    }
    if (!Number.isInteger(xp) || xp < 0) {
      setError("XP must be a whole number of 0 or more.");
      return;
    }
    const bonus = Number(perfectBonusXp || 0);
    if (!Number.isInteger(bonus) || bonus < 0) {
      setError("Perfect-score bonus must be a whole number of 0 or more.");
      return;
    }
    const year = paperYear.trim() === "" ? null : Number(paperYear);
    if (year !== null && (!Number.isInteger(year) || year < 1990 || year > 2100)) {
      setError("Paper year must be a year such as 2024, or blank.");
      return;
    }
    setSaving(true);
    try {
      await api.updateQuiz(quiz.id, {
        maxAttempts: attempts,
        xpReward: xp,
        level: level || null,
        topicId: topicId || null,
        practiceCategoryId: categoryId || null,
        unlockAfterQuizId: unlockAfterId || null,
        requireAllVisited,
        perfectBonusXp: bonus,
        exam: exam.trim() || null,
        paperYear: year,
        note: note.trim() || null,
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-medium text-neutral-800 dark:text-white/90">Student settings</h2>
      <form onSubmit={(e) => void save(e)} className="mt-4 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="max-attempts">Attempts allowed</Label>
            <Input
              id="max-attempts"
              inputMode="numeric"
              placeholder="Unlimited"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="xp-reward">XP for finishing</Label>
            <Input
              id="xp-reward"
              inputMode="numeric"
              value={xpReward}
              onChange={(e) => setXpReward(e.target.value)}
            />
          </div>
          <SelectField
            id="quiz-level"
            label="Level shown to students"
            value={level}
            options={[
              { value: "", label: "— none —" },
              { value: "EASY", label: "Easy" },
              { value: "MEDIUM", label: "Medium" },
              { value: "HARD", label: "Hard" },
            ]}
            onChange={(v) => setLevel(v as DifficultyLevel | "")}
          />
        </div>
        {quiz.subjectId ? (
          <div className="max-w-md">
            <SelectField
              id="quiz-topic"
              label="Topic (makes this a Learn-page topic quiz)"
              value={topicId}
              options={[
                { value: "", label: topics === null ? "Loading topics…" : "— none (a test) —" },
                ...(topics ?? []).map((t) => ({ value: t.id, label: t.title })),
              ]}
              onChange={setTopicId}
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Topic quizzes appear on the topic page and pay double XP for a perfect score.
            </p>
          </div>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Give the quiz a subject to link it to a Learn-page topic.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="quiz-category"
            label="Practice category (lists it on the Practice page)"
            value={categoryId}
            options={[
              {
                value: "",
                label: quiz.subjectId ? "— not on Practice —" : "Give the quiz a subject first",
              },
              ...categories.map((c) => ({ value: c.id, label: c.title })),
            ]}
            onChange={setCategoryId}
          />
          <SelectField
            id="quiz-unlock"
            label="Locked until the student finishes…"
            value={unlockAfterId}
            options={[
              { value: "", label: "— always open —" },
              ...otherQuizzes.map((q) => ({ value: q.id, label: q.title })),
            ]}
            onChange={setUnlockAfterId}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="perfect-bonus">Bonus XP for a perfect score</Label>
            <Input
              id="perfect-bonus"
              inputMode="numeric"
              value={perfectBonusXp}
              onChange={(e) => setPerfectBonusXp(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paper-exam">Past paper: exam</Label>
            <Input
              id="paper-exam"
              placeholder="e.g. UCEED"
              maxLength={40}
              value={exam}
              onChange={(e) => setExam(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paper-year">Past paper: year</Label>
            <Input
              id="paper-year"
              inputMode="numeric"
              placeholder="e.g. 2024"
              value={paperYear}
              onChange={(e) => setPaperYear(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quiz-note">Note for students (optional)</Label>
          <Input
            id="quiz-note"
            maxLength={500}
            placeholder="e.g. Questions recalled by students; may differ slightly from the actual paper."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Exam and year let students filter past papers; papers list newest year first.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={requireAllVisited}
            onChange={(e) => setRequireAllVisited(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Students must open every question before they can submit (the timer still submits
            automatically).
          </span>
        </label>
        <FieldError>{error}</FieldError>
        {saved ? (
          <p role="status" className="text-sm text-success-600 dark:text-success-400">
            Saved.
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
