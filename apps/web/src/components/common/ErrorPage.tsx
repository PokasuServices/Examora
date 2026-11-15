import Link from "next/link";
import { CommonGridShape } from "./CommonGridShape";

const actionClass =
  "inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-5 py-3.5 text-sm font-medium text-neutral-700 shadow-theme-xs hover:bg-neutral-50 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400";

/**
 * TailAdmin error screen (the template behind TMS's ErrorPageView): full
 * screen with corner grid shapes, "ERROR" heading over a large status
 * code, a short message, and Back-to-Home (plus an optional retry).
 */
export function ErrorPage({
  code,
  message,
  homeHref = "/",
  onRetry,
}: {
  /** Shown large in place of the template's illustration, e.g. "404". */
  code: string;
  message: string;
  homeHref?: string;
  /** Renders a "Try again" button (error boundaries pass `reset`). */
  onRetry?: () => void;
}) {
  return (
    <main className="relative z-1 flex min-h-screen flex-col items-center justify-center overflow-hidden p-6">
      <CommonGridShape />
      <div className="mx-auto w-full max-w-[242px] text-center sm:max-w-[472px]">
        <h1 className="mb-8 text-title-md font-bold text-neutral-800 dark:text-white/90">ERROR</h1>
        <p
          aria-hidden="true"
          className="font-heading text-[96px] font-bold leading-none text-primary-600 sm:text-[140px]"
        >
          {code}
        </p>
        <p className="mb-6 mt-10 text-base text-neutral-700 dark:text-neutral-400 sm:text-lg">
          {message}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onRetry ? (
            <button type="button" onClick={onRetry} className={actionClass}>
              Try again
            </button>
          ) : null}
          <Link href={homeHref} className={actionClass}>
            Back to Home Page
          </Link>
        </div>
      </div>
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-sm text-neutral-500 dark:text-neutral-400">
        &copy; {new Date().getFullYear()} - Examora
      </p>
    </main>
  );
}
