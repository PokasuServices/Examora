import * as React from "react";
import { cn } from "../lib/cn";

/** TMS `common/LoaderDefault.vue` — inline spinner with an optional caption. */
export function LoaderDefault({ title, className }: { title?: string; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-3 py-6 text-sm text-neutral-500 dark:text-neutral-400",
        className,
      )}
    >
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"
        aria-hidden="true"
      />
      {title ? <span>{title}</span> : <span className="sr-only">Loading</span>}
    </div>
  );
}

const MESSAGE_STYLES = {
  error:
    "border-danger-200 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/15 text-danger-700 dark:text-danger-300",
  warning:
    "border-warning-200 dark:border-warning-500/30 bg-warning-50 dark:bg-warning-500/15 text-warning-700 dark:text-warning-300",
  success:
    "border-success-200 dark:border-success-500/30 bg-success-50 dark:bg-success-500/15 text-success-700 dark:text-success-300",
  info: "border-primary-200 dark:border-primary-500/30 bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300",
} as const;

/** TMS `forms/GlobalFormMessage.vue` — dismissible form-level banner. */
export function GlobalFormMessage({
  message,
  type = "error",
  onDismiss,
  className,
}: {
  message?: React.ReactNode;
  type?: keyof typeof MESSAGE_STYLES;
  onDismiss?: () => void;
  className?: string;
}): React.ReactElement | null {
  if (!message) return null;
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 text-sm",
        MESSAGE_STYLES[type],
        className,
      )}
    >
      <div className="flex-1">{message}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 opacity-70 hover:opacity-100"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
