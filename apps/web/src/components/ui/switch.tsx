import { cn } from "@examora/ui";

/** Accessible on/off toggle — role="switch", same focus-ring/color tokens as the rest of the design system. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900",
        checked ? "bg-primary-600" : "bg-neutral-200 dark:bg-white/10",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white dark:bg-neutral-900 shadow-soft transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}
