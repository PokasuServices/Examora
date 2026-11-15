import * as React from "react";
import { cn } from "../lib/cn";

/**
 * TMS `Modals/ModalDefault.vue` — blurred backdrop, header with title +
 * close button, scrollable body, optional footer, loading overlay.
 * Closes on Escape and on backdrop click (unless `dismissible` is false).
 */
export interface ModalDefaultProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  footer?: React.ReactNode;
  /** Tailwind max-width class for the dialog, e.g. "max-w-lg" (default) or "max-w-3xl". */
  widthClassName?: string;
  bodyClassName?: string;
  loading?: boolean;
  dismissible?: boolean;
  children?: React.ReactNode;
}

export function ModalDefault({
  open,
  onClose,
  title,
  footer,
  widthClassName = "max-w-lg",
  bodyClassName,
  loading = false,
  dismissible = true,
  children,
}: ModalDefaultProps) {
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissible) onClose();
    }
    document.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-99999 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-neutral-400/50 backdrop-blur-[25px]"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          "relative flex max-h-[calc(100vh-40px)] w-full flex-col rounded-lg bg-white py-6 shadow-lg dark:bg-neutral-800",
          widthClassName,
        )}
      >
        {title ? (
          <div className="mx-6 flex items-center justify-between border-b border-neutral-300 pb-4 dark:border-neutral-700">
            <h4
              id={titleId}
              className="flex items-center gap-2 text-xl text-neutral-900 dark:text-white"
            >
              {title}
            </h4>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200 dark:text-white dark:hover:bg-neutral-700"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ) : null}

        <div className={cn("flex-1 overflow-auto px-6 py-4", bodyClassName)}>{children}</div>

        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-[2px] dark:bg-neutral-800/80">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : null}

        {footer ? (
          <div className="mx-6 flex justify-end gap-2 border-t border-neutral-300 pt-4 dark:border-neutral-700">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
