import Link from "next/link";
import { ClipboardList, Users } from "lucide-react";

/**
 * Kept deliberately small: most "quick actions" a mentor might want (log a
 * meeting, add a task, leave feedback) require picking a student first —
 * they're one click away on Student 360, not zero-click from here. These
 * two are the only truly student-agnostic shortcuts.
 */
export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading">
      <h2
        id="quick-actions-heading"
        className="text-lg font-medium text-neutral-800 dark:text-white/90"
      >
        Quick actions
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link
          href="/mentor/students"
          className="flex items-center gap-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 shadow-soft transition-colors hover:border-primary-200 dark:hover:border-primary-500/30 hover:bg-primary-50/50 hover:text-primary-700 dark:hover:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Users size={18} strokeWidth={1.75} aria-hidden="true" />
          View all students
        </Link>
        <a
          href="#pending-reviews-heading"
          className="flex items-center gap-3 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 shadow-soft transition-colors hover:border-primary-200 dark:hover:border-primary-500/30 hover:bg-primary-50/50 hover:text-primary-700 dark:hover:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ClipboardList size={18} strokeWidth={1.75} aria-hidden="true" />
          Jump to pending reviews
        </a>
      </div>
    </section>
  );
}
