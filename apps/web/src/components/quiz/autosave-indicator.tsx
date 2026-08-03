import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { AutosaveStatus } from "./types";

/** Reflects the real state of the last autosaveAnswer request — never a fabricated "always saved" claim. */
export function AutosaveIndicator({ status }: { status: AutosaveStatus }) {
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
        Couldn&rsquo;t save — try reselecting
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
