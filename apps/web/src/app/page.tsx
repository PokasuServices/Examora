import { Suspense } from "react";
import { ApiStatus } from "@/components/api-status";
import { AuthNav } from "@/components/auth-nav";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-heading">Examora</h1>
        <Suspense fallback={<span className="text-sm text-neutral-500">Checking API…</span>}>
          <ApiStatus />
        </Suspense>
      </div>
      <p className="text-body text-neutral-600">
        Sprint 1 — Authentication &amp; Identity. Course, learning and assessment features are not
        implemented yet. See{" "}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-caption">
          docs/roadmap/SPRINT_BACKLOG.md
        </code>{" "}
        for what&apos;s next.
      </p>
      <AuthNav />
    </main>
  );
}
