import { Suspense } from "react";
import { ApiStatus } from "@/components/api-status";
import { AuthNav } from "@/components/auth-nav";
import { HomeGate } from "@/components/home-gate";
import { HomepageBanner } from "@/components/homepage-banner";

export default function HomePage() {
  return (
    <HomeGate>
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
          Browse courses, work through lessons and quizzes, submit assignments, join the community,
          and track your progress — all in one place.
        </p>
        <AuthNav />
      </main>
    </HomeGate>
  );
}
