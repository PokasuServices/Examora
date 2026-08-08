"use client";

import Link from "next/link";
import { ArrowLeft, Milestone } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LearningPathRoadmap } from "@/components/recommendations/learning-path-roadmap";
import { useLearningPath } from "@/components/recommendations/use-learning-path";

function LearningPathContent() {
  const data = useLearningPath();
  const isEmpty =
    data.completed.length === 0 && data.current.length === 0 && data.next.length === 0;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/recommendations"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Recommendations
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
          Your Learning Path
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Where you&rsquo;ve been, where you are, and what&rsquo;s suggested next.
        </p>
      </div>

      {data.status === "loading" ? (
        <Card>
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="mt-3 h-4 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </Card>
      ) : data.status === "error" ? (
        <RetryInline message="Couldn't load your learning path" onRetry={data.retry} />
      ) : isEmpty ? (
        <EmptyState
          icon={Milestone}
          heading="Your path starts with your first course"
          body="Enroll in a course and complete a lesson or two — we'll map out completed milestones and suggest what's next."
          actionLabel="Browse courses"
          actionHref="/courses"
        />
      ) : (
        <Card>
          <LearningPathRoadmap completed={data.completed} current={data.current} next={data.next} />
        </Card>
      )}
    </main>
  );
}

export default function LearningPathPage() {
  return (
    <RequireAuth>
      <LearningPathContent />
    </RequireAuth>
  );
}
