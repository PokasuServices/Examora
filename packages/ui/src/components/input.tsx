import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Form primitives — React port of the TMS `forms/` set (TailAdmin):
 * `.form-input` field styling, `LabelText`, `ErrorMessage`, and the
 * composite `TextInputDefault` (label + icon slot + password eye toggle +
 * error/note). `Input` / `Label` / `FieldError` keep their original names
 * so every existing form renders the new look with no call-site changes.
 */

export const inputBaseClass =
  "h-11 w-full rounded-md border bg-transparent px-4 py-2.5 text-sm text-neutral-800 dark:text-white/90 shadow-theme-xs " +
  "placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-4 " +
  "disabled:cursor-not-allowed disabled:border-neutral-100 dark:disabled:border-neutral-800 disabled:bg-neutral-50 dark:disabled:bg-white/[0.03] disabled:placeholder:text-neutral-300 " +
  "dark:bg-neutral-900 dark:text-white/90 dark:placeholder:text-white/30";

export const inputStateClass = (invalid?: boolean) =>
  invalid
    ? "border-danger-500 ring-4 ring-danger-500/10 focus:border-danger-500 focus:ring-danger-500/10"
    : "border-neutral-300 focus:border-primary-300 focus:ring-primary-500/10 dark:border-neutral-700 dark:focus:border-primary-800";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid}
        className={cn(inputBaseClass, inputStateClass(invalid), className)}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Shows a red required-field asterisk (TMS LabelText `asterisk`). */
  asterisk?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, asterisk, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("block text-sm font-medium text-neutral-700 dark:text-neutral-400", className)}
      {...props}
    >
      {children}
      {asterisk ? <span className="ml-0.5 text-danger-500">*</span> : null}
    </label>
  ),
);
Label.displayName = "Label";

/** TMS naming alias. */
export const LabelText = Label;

export const FieldError = ({
  children,
}: {
  children?: React.ReactNode;
}): React.ReactElement | null => {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-danger-600 dark:text-danger-400">
      {children}
    </p>
  );
};

const MESSAGE_TONE = {
  error: "text-danger-600 dark:text-danger-400",
  warning: "text-warning-600 dark:text-warning-400",
  info: "text-neutral-500 dark:text-neutral-400",
} as const;

/** TMS `ErrorMessage.vue` — one or many messages, tone-colored. */
export function ErrorMessage({
  message,
  type = "error",
  className,
}: {
  message?: string | string[] | null;
  type?: keyof typeof MESSAGE_TONE;
  className?: string;
}): React.ReactElement | null {
  const messages = (Array.isArray(message) ? message : [message]).filter(Boolean) as string[];
  if (messages.length === 0) return null;
  return (
    <div
      role={type === "error" ? "alert" : undefined}
      className={cn("flex flex-col", MESSAGE_TONE[type], className)}
    >
      {messages.map((msg) => (
        <span key={msg} className="text-sm">
          {msg}
        </span>
      ))}
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20" />
    </svg>
  );
}

export interface TextInputDefaultProps extends Omit<InputProps, "size"> {
  id: string;
  labelText?: string;
  asterisk?: boolean;
  /** Icon element shown inside the field (TMS `#icon` slot). */
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  errorMessage?: string | string[] | null;
  errorType?: "error" | "warning" | "info";
  /** Helper text under the field (TMS `note`). */
  note?: React.ReactNode;
  parentClassName?: string;
}

/**
 * TMS `TextInputDefault.vue` — label, field, optional icon, password
 * show/hide toggle, and inline error/note. Password fields get the eye
 * toggle automatically, as in TMS (`icon="eye"`).
 */
export const TextInputDefault = React.forwardRef<HTMLInputElement, TextInputDefaultProps>(
  (
    {
      id,
      labelText,
      asterisk,
      icon,
      iconPosition = "right",
      errorMessage,
      errorType = "error",
      note,
      parentClassName,
      type = "text",
      className,
      ...props
    },
    ref,
  ) => {
    const [reveal, setReveal] = React.useState(false);
    const isPassword = type === "password";
    const hasError =
      !!errorMessage &&
      errorType === "error" &&
      (Array.isArray(errorMessage) ? errorMessage.length > 0 : true);
    const trailing = isPassword ? (
      <button
        type="button"
        onClick={() => setReveal((r) => !r)}
        aria-label={reveal ? "Hide password" : "Show password"}
        className="flex h-full items-center px-4 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 dark:text-neutral-400"
      >
        <EyeIcon open={!reveal} />
      </button>
    ) : icon ? (
      <span className="pointer-events-none flex h-full items-center px-4 text-neutral-500 dark:text-neutral-400">
        {icon}
      </span>
    ) : null;
    const iconOnLeft = !isPassword && iconPosition === "left";

    return (
      <div className={cn("flex flex-col gap-1.5", parentClassName)}>
        {labelText ? (
          <Label htmlFor={id} asterisk={asterisk}>
            {labelText}
          </Label>
        ) : null}
        <div className="relative">
          <Input
            ref={ref}
            id={id}
            type={isPassword && reveal ? "text" : type}
            invalid={hasError}
            aria-describedby={errorMessage ? `${id}-error` : undefined}
            className={cn(trailing && (iconOnLeft ? "pl-12" : "pr-12"), className)}
            {...props}
          />
          {trailing ? (
            <span className={cn("absolute inset-y-0 flex", iconOnLeft ? "left-0" : "right-0")}>
              {trailing}
            </span>
          ) : null}
        </div>
        {note ? <p className="text-xs text-neutral-500 dark:text-neutral-400">{note}</p> : null}
        <div id={`${id}-error`}>
          <ErrorMessage message={errorMessage} type={errorType} />
        </div>
      </div>
    );
  },
);
TextInputDefault.displayName = "TextInputDefault";
