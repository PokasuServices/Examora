import { AlertCircle, Check, Loader2 } from "lucide-react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

/** Reflects the real state of the last save request — never a fabricated "always saved" claim. Shared by the Quiz autosave-per-answer flow and the Assignment notes/file autosave flow. */
export function AutosaveIndicator({
  status,
  errorLabel = "Couldn't save — try again",
}: {
  status: AutosaveStatus;
  errorLabel?: string;
}) {
  if (status === "idle") return null;

  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
        <Loader2
          size={13}
          strokeWidth={2}
          className="animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-error-600">
        <AlertCircle size={13} strokeWidth={2} aria-hidden="true" />
        {errorLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
      <Check size={13} strokeWidth={2} aria-hidden="true" />
      Saved
    </span>
  );
}
