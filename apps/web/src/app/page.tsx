import { Suspense } from "react";
import { ApiStatus } from "@/components/api-status";
import { AuthNav } from "@/components/auth-nav";
import { HomepageBanner } from "@/components/homepage-banner";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-heading">Examora</h1>
        <Suspense fallback={<span className="text-sm text-neutral-500">Checking API…</span>}>
          <ApiStatus />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <HomepageBanner />
      </Suspense>
      <p className="text-body text-neutral-600">
        Sprint 3 — Learning Engine. Browse published courses, work through lessons, and track your
        progress. Quizzes, assignments and later modules are still to come. See{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-caption">
          docs/roadmap/SPRINT_BACKLOG.md
        </code>{" "}
        for what&apos;s next.
      </p>
      <AuthNav />
    </main>
  );
}
