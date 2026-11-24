"use client";

import * as React from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import type { ContentStatus, Question } from "@examora/types";
import { Button } from "@examora/ui";
import { QuestionEditor } from "@/components/question-editor";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useAssessmentApi } from "@/lib/assessment-api";

const STATUS_FILTERS: (ContentStatus | "ALL")[] = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

const STATUS_TONE: Record<ContentStatus, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

function CreateQuestionForm({ onCreated }: { onCreated: () => void }) {
  // Remount the editor after each create so the form starts empty again.
  const [formKey, setFormKey] = React.useState(0);
  return (
    <Card>
      <h2 className="text-lg font-medium text-neutral-800 dark:text-white/90">New question</h2>
      <div className="mt-4">
        <QuestionEditor
          key={formKey}
          onSaved={() => {
            setFormKey((k) => k + 1);
            onCreated();
          }}
        />
      </div>
    </Card>
  );
}

function QuestionsContent() {
  const api = useAssessmentApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [filter, setFilter] = React.useState<ContentStatus | "ALL">("ALL");

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listQuestions(filter === "ALL" ? undefined : { status: filter })
      .then((res) => {
        setQuestions(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Question bank"
        subtitle="Author reusable questions and publish them for use in quizzes."
        actions={
          <Link href="/assessment/quizzes">
            <Button variant="secondary">Manage quizzes</Button>
          </Link>
        }
      />

      <CreateQuestionForm onCreated={load} />

      <Card density="compact">
        <div className="max-w-xs">
          <SelectField
            id="question-status-filter"
            label="Status"
            value={filter}
            options={STATUS_FILTERS.map((s) => ({
              value: s,
              label: s === "ALL" ? "All statuses" : statusLabel(s),
            }))}
            onChange={(v) => setFilter(v as ContentStatus | "ALL")}
          />
        </div>
      </Card>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load questions" onRetry={load} />
        ) : questions.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            heading="No questions found"
            body="Try a different status filter, or create one above."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-white/[0.03]">
                <tr>
                  <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Text
                  </th>
                  <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Type
                  </th>
                  <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Difficulty
                  </th>
                  <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Status
                  </th>
                  <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {questions.map((q) => (
                  <tr key={q.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.03]">
                    <td className="max-w-md truncate px-4 py-3 text-neutral-800 dark:text-white/90">
                      {q.text}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {statusLabel(q.type)}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {statusLabel(q.difficulty)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={STATUS_TONE[q.status]}>{statusLabel(q.status)}</Chip>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/assessment/questions/${q.id}`}
                        className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}

export default function QuestionsPage() {
  return (
    <RequirePermission permission="question:manage">
      <QuestionsContent />
    </RequirePermission>
  );
}
