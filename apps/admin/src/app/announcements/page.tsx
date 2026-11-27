"use client";

import * as React from "react";
import { ExternalLink, Megaphone, Send } from "lucide-react";
import type { BatchAnnouncementView, CohortView } from "@examora/types";
import { Button, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pill, ToneCard, ToneIcon, timeAgo, useToast } from "@/components/desk-ui";
import { useDeskApi } from "@/lib/desk-api";
import { useStudentAdminApi } from "@/lib/student-admin-api";

const TEMPLATES = [
  {
    title: "No class today",
    body: "Today's class is cancelled. We'll cover the topic in the next class.",
  },
  {
    title: "Mock test reminder",
    body: "The mock test is live on your Practice page. Finish it before Sunday night.",
  },
  {
    title: "Bring your materials",
    body: "Please bring A3 sheets, 2B/4B pencils and an eraser to the next class.",
  },
  { title: "Resources from today's class", body: "Here are the notes and examples we used today." },
];

function AnnouncementsContent() {
  const api = useDeskApi();
  const studentApi = useStudentAdminApi();
  const { toast, toastError, node } = useToast();
  const [batches, setBatches] = React.useState<CohortView[]>([]);
  const [chosen, setChosen] = React.useState<string[]>([]);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [link, setLink] = React.useState("");
  const [rows, setRows] = React.useState<BatchAnnouncementView[] | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .announcements()
      .then(setRows)
      .catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    load();
    studentApi
      .cohorts()
      .then((b) => {
        const active = b.filter((x) => x.isActive);
        setBatches(active);
        setChosen(active.slice(0, 1).map((x) => x.id));
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function send() {
    setBusy(true);
    try {
      const sent = await api.announce({ cohortIds: chosen, title, body, linkUrl: link || null });
      const students = batches
        .filter((b) => chosen.includes(b.id))
        .reduce((n, b) => n + b.memberCount, 0);
      toast(
        `Sent to ${sent.length} batch${sent.length > 1 ? "es" : ""} (${students} students get a notification)`,
      );
      setTitle("");
      setBody("");
      setLink("");
      load();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-col gap-6">
      {node}
      <PageHeader
        title="Announcements"
        subtitle="Message your batches: class changes, reminders, resources after class. Students get a bell notification."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <ToneCard tone="indigo" className="p-5">
          <h2 className="font-heading text-base font-semibold">New announcement</h2>
          <fieldset className="mt-3">
            <legend className="text-sm font-medium">To</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {batches.map((b) => (
                <label
                  key={b.id}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <input
                    type="checkbox"
                    checked={chosen.includes(b.id)}
                    onChange={() =>
                      setChosen((c) =>
                        c.includes(b.id) ? c.filter((x) => x !== b.id) : [...c, b.id],
                      )
                    }
                  />
                  {b.name} <span className="text-xs text-neutral-500">{b.memberCount}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                type="button"
                onClick={() => {
                  setTitle(t.title);
                  setBody(t.body);
                }}
                className="rounded-full bg-white px-2.5 py-1 text-xs text-indigo-700 shadow-soft hover:bg-indigo-50 dark:bg-neutral-900 dark:text-indigo-300"
              >
                {t.title}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <Label htmlFor="an-title">Title</Label>
            <Input
              id="an-title"
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <Label htmlFor="an-body">Message</Label>
            <textarea
              id="an-body"
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-28 rounded-md border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <Label htmlFor="an-link">Link (optional): notes, a video, the class link</Label>
            <Input
              id="an-link"
              type="url"
              placeholder="https://"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              disabled={
                busy || chosen.length === 0 || title.trim().length < 3 || body.trim().length < 3
              }
              onClick={() => void send()}
            >
              <Send size={14} aria-hidden="true" /> Send
            </Button>
          </div>
        </ToneCard>
        <section>
          <h2 className="mb-3 font-heading text-base font-semibold">Sent</h2>
          {rows === null ? (
            <Card className="text-sm text-neutral-500">Loading…</Card>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState icon={Megaphone} heading="Nothing sent yet" />
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((a, i) => (
                <li key={a.id}>
                  <ToneCard tone="cyan" index={i} className="p-3">
                    <div className="flex items-start gap-3">
                      <ToneIcon tone="cyan" icon={Megaphone} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="mt-0.5 line-clamp-3 text-xs text-neutral-600 dark:text-neutral-300">
                          {a.body}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Pill tone="slate">{a.cohortName}</Pill>
                          <span className="text-[11px] text-neutral-400">
                            {a.author.name} · {timeAgo(a.createdAt)}
                          </span>
                          {a.linkUrl ? (
                            <a
                              href={a.linkUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-[11px] text-primary-600 hover:underline"
                            >
                              <ExternalLink size={10} aria-hidden="true" /> link
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </ToneCard>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default function AnnouncementsPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <AnnouncementsContent />
    </RequirePermission>
  );
}
