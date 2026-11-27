"use client";

import * as React from "react";
import { CheckCircle2, HelpCircle, MessageSquare, RotateCcw, UserCheck } from "lucide-react";
import type { MentorDoubtItem, MentorDoubtThread } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { Pill, ToneCard, timeAgo, useToast } from "@/components/desk-ui";
import { useDeskApi } from "@/lib/desk-api";

function Thread({ id, onChanged }: { id: string; onChanged: () => void }) {
  const api = useDeskApi();
  const { toast, toastError, node } = useToast();
  const [t, setT] = React.useState<MentorDoubtThread | null>(null);
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setT(null);
    setBody("");
    api
      .doubt(id)
      .then(setT)
      .catch((e) => toastError(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!t) return <Card className="text-sm text-neutral-500">Loading…</Card>;
  const d = t.doubt;

  async function send(resolve: boolean) {
    setBusy(true);
    try {
      setT(await api.replyDoubt(id, body, resolve));
      setBody("");
      toast(resolve ? "Answered and marked solved" : "Answer posted");
      onChanged();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToneCard tone={d.resolvedAt ? "emerald" : "amber"} className="p-5">
      {node}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {d.courseTitle ?? "Question"}
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-900 dark:text-white">
            {d.questionText}
          </p>
        </div>
        {d.resolvedAt ? (
          <Pill tone="emerald">
            <CheckCircle2 size={12} aria-hidden="true" /> Solved
          </Pill>
        ) : (
          <Pill tone="amber">Open</Pill>
        )}
      </div>

      <ol className="mt-4 flex flex-col gap-3">
        <li className="rounded-lg bg-white p-3 shadow-soft dark:bg-neutral-900">
          <p className="text-xs text-neutral-500">
            <strong className="text-neutral-800 dark:text-neutral-100">{d.author.name}</strong>
            {d.inMyBatch ? " · your batch" : ""} · {timeAgo(d.createdAt)}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">
            {d.body}
          </p>
        </li>
        {t.replies.map((r) => (
          <li
            key={r.id}
            className={cn(
              "rounded-lg p-3",
              r.isStaff
                ? "ml-6 bg-indigo-50 dark:bg-indigo-500/10"
                : "bg-white shadow-soft dark:bg-neutral-900",
            )}
          >
            <p className="text-xs text-neutral-500">
              <strong className="text-neutral-800 dark:text-neutral-100">{r.author.name}</strong>
              {r.isStaff ? " · mentor" : ""} · {timeAgo(r.createdAt)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">
              {r.body}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-4">
        <label
          htmlFor="answer"
          className="text-xs font-medium text-neutral-600 dark:text-neutral-300"
        >
          Your answer (Markdown and $maths$ work, as on the student site)
        </label>
        <textarea
          id="answer"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Explain the idea, then the steps…"
          className="mt-1 min-h-28 w-full rounded-md border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          {d.resolvedAt ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  setT(await api.resolveDoubt(id, false));
                  onChanged();
                } catch (e) {
                  toastError(e);
                }
              }}
            >
              <RotateCcw size={14} aria-hidden="true" /> Reopen
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  setT(await api.resolveDoubt(id, true));
                  toast("Marked solved");
                  onChanged();
                } catch (e) {
                  toastError(e);
                }
              }}
            >
              <CheckCircle2 size={14} aria-hidden="true" /> Mark solved
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || body.trim().length < 2}
            onClick={() => void send(false)}
          >
            Answer
          </Button>
          <Button
            size="sm"
            disabled={busy || body.trim().length < 2}
            onClick={() => void send(true)}
          >
            Answer and mark solved
          </Button>
        </div>
      </div>
    </ToneCard>
  );
}

function DoubtsContent() {
  const api = useDeskApi();
  const [status, setStatus] = React.useState<"open" | "resolved" | "all">("open");
  const [scope, setScope] = React.useState<"batches" | "course">("course");
  const [rows, setRows] = React.useState<MentorDoubtItem[] | null>(null);
  const [error, setError] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const load = React.useCallback(() => {
    setError(false);
    api
      .doubts(status, scope)
      .then((r) => {
        setRows(r);
        setSelected((s) => s ?? r[0]?.id ?? null);
      })
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, scope]);
  React.useEffect(() => load(), [load]);

  const chip = (on: boolean) =>
    cn(
      "rounded-full px-3 py-1 text-xs font-medium",
      on
        ? "bg-primary-600 text-white"
        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
    );

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Doubts"
        subtitle="Questions students asked on your courses. Students in your batches come first."
      />
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Status" className="flex gap-1.5">
          {(["open", "resolved", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              className={chip(status === s)}
              onClick={() => {
                setStatus(s);
                setSelected(null);
              }}
            >
              {s === "open" ? "Open" : s === "resolved" ? "Solved" : "All"}
            </button>
          ))}
        </div>
        <div role="tablist" aria-label="Whose doubts" className="flex gap-1.5">
          <button
            type="button"
            role="tab"
            aria-selected={scope === "course"}
            className={chip(scope === "course")}
            onClick={() => {
              setScope("course");
              setSelected(null);
            }}
          >
            My courses
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "batches"}
            className={chip(scope === "batches")}
            onClick={() => {
              setScope("batches");
              setSelected(null);
            }}
          >
            My batches only
          </button>
        </div>
      </div>
      {error ? (
        <RetryInline message="Couldn't load doubts" onRetry={load} />
      ) : rows === null ? (
        <Card className="text-sm text-neutral-500">Loading…</Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={HelpCircle}
            heading={status === "open" ? "No open doubts" : "Nothing here"}
            body="When students ask about a question, it shows up here."
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Card density="compact" className="self-start p-0">
            <ul className="max-h-[38rem] divide-y divide-neutral-200 overflow-y-auto dark:divide-neutral-800">
              {rows.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(d.id)}
                    aria-current={selected === d.id ? "true" : undefined}
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-white/[0.03]",
                      selected === d.id && "bg-primary-50 dark:bg-primary-500/15",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{d.author.name}</span>
                      <span className="shrink-0 text-[11px] text-neutral-500">
                        {timeAgo(d.createdAt)}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-xs text-neutral-600 dark:text-neutral-300">
                      {d.body}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {d.inMyBatch ? (
                        <Pill tone="indigo">
                          <UserCheck size={11} aria-hidden="true" /> My batch
                        </Pill>
                      ) : null}
                      {d.resolvedAt ? (
                        <Pill tone="emerald">Solved</Pill>
                      ) : d.answeredByStaff ? (
                        <Pill tone="cyan">Answered</Pill>
                      ) : (
                        <Pill tone="amber">Waiting</Pill>
                      )}
                      {d.replies ? (
                        <Pill tone="slate">
                          <MessageSquare size={11} aria-hidden="true" /> {d.replies}
                        </Pill>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {selected ? <Thread key={selected} id={selected} onChanged={load} /> : null}
        </div>
      )}
    </main>
  );
}

export default function DoubtsPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <DoubtsContent />
    </RequirePermission>
  );
}
