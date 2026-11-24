"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Markdown from "react-markdown";
import { CalendarDays, Users, Video } from "lucide-react";
import { Button } from "@examora/ui";
import { markdownComponents } from "@/components/lesson-viewer/lesson-content";
import { RequireAuth } from "@/components/require-auth";
import { formatWhen } from "@/components/student/college-visuals";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { StudyImage } from "@/components/student/study-image";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { PageHeader } from "@/components/ui/page-header";
import { studyUrlTransform } from "@/lib/media";
import { useStudentApi } from "@/lib/student-api";

function WebinarContent() {
  const { slug } = useParams<{ slug: string }>();
  const api = useStudentApi();
  const { data, errorStatus, loading, reload } = useLoad(() => api.webinar(slug), slug);
  const [busy, setBusy] = React.useState(false);

  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !data) return <LoadingPanel />;
  const ended = new Date(data.endsAt) < new Date();

  async function toggle(on: boolean) {
    setBusy(true);
    try {
      await api.setRegistered(data!.id, on);
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={data.title} trail={[{ label: "Colleges", href: "/colleges" }]} />
      {data.bannerUrl ? <StudyImage src={data.bannerUrl} alt="" className="w-full" /> : null}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-6 text-sm text-neutral-700 dark:text-neutral-300">
          <span className="flex items-center gap-2">
            <IconBadge icon={CalendarDays} size={24} tone="primary" />{" "}
            {formatWhen(data.startsAt, data.endsAt)}
          </span>
          <span className="flex items-center gap-2">
            <IconBadge icon={Users} size={24} /> {data.registrations} registered
          </span>
          {data.collegeName && data.collegeId ? <span>Hosted by {data.collegeName}</span> : null}
        </div>
        {ended ? (
          <p className="text-sm text-neutral-500">This webinar has ended.</p>
        ) : data.registered ? (
          <div className="flex flex-wrap items-center gap-3">
            {data.joinUrl ? (
              <a
                href={data.joinUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700"
              >
                <Video size={16} aria-hidden="true" /> Join webinar
              </a>
            ) : (
              <span className="text-sm text-success-600">
                You&rsquo;re registered. The join link appears here before it starts.
              </span>
            )}
            <Button variant="ghost" disabled={busy} onClick={() => void toggle(false)}>
              Cancel registration
            </Button>
          </div>
        ) : (
          <div>
            <Button disabled={busy} onClick={() => void toggle(true)}>
              {busy ? "Registering…" : "Register"}
            </Button>
          </div>
        )}
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
      <Link href="/colleges" className="text-sm font-medium text-primary-600 hover:underline">
        ← Back to colleges
      </Link>
    </main>
  );
}

export default function WebinarPage() {
  return (
    <RequireAuth>
      <WebinarContent />
    </RequireAuth>
  );
}
