"use client";

import * as React from "react";
import { ArrowRight, Briefcase } from "lucide-react";
import { ADMIN_ORIGIN } from "@/components/admin-dashboard/admin-links";

/**
 * Shown instead of the learner shell to people who work in the staff
 * workspace (mentors). Sends them there straight away; the link is a fallback
 * if the redirect is blocked. The workspace signs them in from the same
 * session cookie, so there is no second login.
 */
export function StaffHandoff() {
  React.useEffect(() => {
    window.location.replace(ADMIN_ORIGIN);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-theme-sm dark:border-neutral-800 dark:bg-neutral-900">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
          <Briefcase size={20} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white">
          Opening your staff workspace…
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Mentors work in the staff workspace: batches, reviews, content and attendance. The student
          site is for learners.
        </p>
        <a
          href={ADMIN_ORIGIN}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Go to staff workspace <ArrowRight size={15} aria-hidden="true" />
        </a>
      </div>
    </main>
  );
}
