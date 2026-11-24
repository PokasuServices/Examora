"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Markdown from "react-markdown";
import { Bookmark, ExternalLink } from "lucide-react";
import { Button } from "@examora/ui";
import { markdownComponents } from "@/components/lesson-viewer/lesson-content";
import { RequireAuth } from "@/components/require-auth";
import {
  CATEGORY_LABEL,
  CollegeLogo,
  formatFee,
  formatWhen,
} from "@/components/student/college-visuals";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { studyUrlTransform } from "@/lib/media";
import { useStudentApi } from "@/lib/student-api";

function CollegeContent() {
  const { slug } = useParams<{ slug: string }>();
  const api = useStudentApi();
  const { data, errorStatus, loading, reload } = useLoad(() => api.college(slug), slug);
  const [shortlisted, setShortlisted] = React.useState<boolean | null>(null);
  const [message, setMessage] = React.useState("");
  const [enquiry, setEnquiry] = React.useState<"idle" | "sending" | "sent" | "error" | "duplicate">(
    "idle",
  );

  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !data) return <LoadingPanel />;
  const isShortlisted = shortlisted ?? data.shortlisted;
  const enquired = data.enquired || enquiry === "sent" || enquiry === "duplicate";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title={data.name}
        trail={[{ label: "Colleges", href: "/colleges" }]}
        actions={
          <Button
            variant={isShortlisted ? "primary" : "outline"}
            onClick={async () => {
              const next = !isShortlisted;
              setShortlisted(next);
              await api.setShortlisted(data.id, next).catch(() => setShortlisted(!next));
            }}
            aria-pressed={isShortlisted}
          >
            <Bookmark
              size={16}
              aria-hidden="true"
              className={isShortlisted ? "fill-current" : ""}
            />
            {isShortlisted ? "Shortlisted" : "Shortlist"}
          </Button>
        }
      />

      <Card className="flex flex-wrap items-start gap-4">
        <CollegeLogo src={data.logoUrl} name={data.name} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{data.city}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.categories.map((c) => (
              <Chip key={c} tone="neutral">
                {CATEGORY_LABEL[c]}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            {formatFee(data.applicationFee)}
          </p>
          {data.website ? (
            <a
              href={data.website}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
            >
              Official website <ExternalLink size={13} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </Card>

      {data.description ? (
        <Card>
          <div className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            <Markdown components={markdownComponents} urlTransform={studyUrlTransform}>
              {data.description}
            </Markdown>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">
            Ask the college
          </h2>
          {enquired ? (
            <p className="mt-2 text-sm text-success-600">
              Enquiry sent. The college team will contact you on your registered email.
            </p>
          ) : (
            <>
              <label
                htmlFor="enquiry"
                className="mt-2 block text-sm text-neutral-600 dark:text-neutral-400"
              >
                Your question (optional)
              </label>
              <textarea
                id="enquiry"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-2 min-h-20 w-full rounded-md border border-neutral-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900"
              />
              {enquiry === "error" ? (
                <p className="mt-2 text-sm text-danger-600">Couldn&rsquo;t send. Try again.</p>
              ) : null}
              <Button
                className="mt-3"
                disabled={enquiry === "sending"}
                onClick={async () => {
                  setEnquiry("sending");
                  try {
                    await api.enquire(data.id, message.trim());
                    setEnquiry("sent");
                  } catch (err) {
                    setEnquiry(
                      (err as { status?: number })?.status === 409 ? "duplicate" : "error",
                    );
                  }
                }}
              >
                {enquiry === "sending" ? "Sending…" : "Send enquiry"}
              </Button>
            </>
          )}
        </Card>
        <Card>
          <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">Webinars</h2>
          {data.webinars.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No upcoming webinars.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {data.webinars.map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/webinars/${w.slug}`}
                    className="block rounded-md border border-neutral-200 p-3 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-white/[0.03]"
                  >
                    <span className="block text-sm font-medium text-neutral-800 dark:text-white/90">
                      {w.title}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {formatWhen(w.startsAt, w.endsAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}

export default function CollegePage() {
  return (
    <RequireAuth>
      <CollegeContent />
    </RequireAuth>
  );
}
