"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Markdown from "react-markdown";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { markdownComponents } from "@/components/lesson-viewer/lesson-content";
import { learnTrail } from "@/components/student/learn-trail";
import { LessonPractice } from "@/components/student/lesson-practice";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { useLoad } from "@/components/student/use-load";
import { VideoPlayer } from "@/components/student/video-player";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { useXp } from "@/context/XpContext";
import { useLearnApi } from "@/lib/learn-api";
import { rehypePlugins, remarkPlugins } from "@/lib/markdown-plugins";
import { mediaUrl, studyUrlTransform } from "@/lib/media";

const NAV_LINK =
  "inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-white/5";

function LessonContent() {
  const { id } = useParams<{ id: string }>();
  const api = useLearnApi();
  const { refresh: refreshXp } = useXp();
  const { data, errorStatus, loading, reload } = useLoad(() => api.getLesson(id), id);
  const [completing, setCompleting] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [earned, setEarned] = React.useState<number | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setCompleted(data?.lesson.completed ?? false);
    setEarned(null);
    setFailed(false);
  }, [data]);

  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !data) return <LoadingPanel />;
  const { lesson, crumbs } = data;

  async function complete() {
    setCompleting(true);
    setFailed(false);
    try {
      const result = await api.completeLesson(lesson.id);
      setCompleted(true);
      setEarned(result.xpAwarded);
      if (result.xpAwarded > 0) void refreshXp();
    } catch {
      setFailed(true);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title={lesson.title}
        trail={learnTrail(crumbs, "topic")}
        actions={
          completed ? (
            <Chip tone="success">Completed</Chip>
          ) : (
            <Chip tone="warning">+{lesson.xpReward} XP when completed</Chip>
          )
        }
      />

      <Card>
        <article>
          {lesson.contentType === "VIDEO" && lesson.contentUrl ? (
            <div className="mb-6">
              <VideoPlayer
                url={mediaUrl(lesson.contentUrl) ?? lesson.contentUrl}
                title={lesson.title}
              />
            </div>
          ) : null}
          {lesson.body ? (
            <div className="text-base leading-relaxed text-neutral-700 dark:text-neutral-300">
              <Markdown
                components={markdownComponents}
                urlTransform={studyUrlTransform}
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
              >
                {lesson.body}
              </Markdown>
            </div>
          ) : lesson.contentType !== "VIDEO" && lesson.contentUrl ? (
            <a
              href={lesson.contentUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary-600 underline"
            >
              Open the lesson material ↗
            </a>
          ) : !lesson.contentUrl ? (
            <p className="text-neutral-500 dark:text-neutral-400">
              No content has been added to this lesson yet.
            </p>
          ) : null}
        </article>
      </Card>

      <LessonPractice lessonId={lesson.id} questions={data.practiceQuestions} />

      <Card density="compact" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {data.previousLessonId ? (
            <Link href={`/learn/lessons/${data.previousLessonId}`} className={NAV_LINK}>
              <ArrowLeft size={16} aria-hidden="true" /> Previous
            </Link>
          ) : null}
          {data.nextLessonId ? (
            <Link href={`/learn/lessons/${data.nextLessonId}`} className={NAV_LINK}>
              Next <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : crumbs.topic ? (
            <Link href={`/learn/topics/${crumbs.topic.id}`} className={NAV_LINK}>
              Back to topic
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span aria-live="polite" className="text-sm">
            {earned !== null && earned > 0 ? (
              <span className="font-medium text-success-600">+{earned} XP earned</span>
            ) : failed ? (
              <span className="text-danger-600">Couldn&rsquo;t save. Please try again.</span>
            ) : null}
          </span>
          {completed ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-600">
              <CheckCircle2 size={18} aria-hidden="true" /> Done
            </span>
          ) : (
            <Button onClick={() => void complete()} disabled={completing}>
              {completing ? "Saving…" : "Mark as complete"}
            </Button>
          )}
        </div>
      </Card>
    </main>
  );
}

export default function LearnLessonPage() {
  return (
    <RequireAuth>
      <LessonContent />
    </RequireAuth>
  );
}
