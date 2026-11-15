import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * BaseButton — React port of the TMS `Buttons/BaseButton.vue` (TailAdmin).
 * Same variant set (primary / secondary / normal / outline / danger /
 * success + their "normal" hover-fill twins), same size scale (xss → lg),
 * loading spinner and left/right icon slot. Colors come from each app's
 * own token overrides, so it renders in Examora's palette.
 *
 * `Button` is kept as the original export name so every existing call
 * site (`<Button variant="secondary" size="sm">`) keeps working unchanged.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium transition " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/10 " +
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border-primary-600 bg-primary-600 text-white hover:border-primary-700 hover:bg-primary-700",
        secondary:
          "border-transparent bg-neutral-200 text-neutral-700 hover:bg-neutral-300 hover:text-neutral-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10",
        normal:
          "border-neutral-300 bg-transparent text-neutral-700 hover:bg-neutral-100 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/10",
        ghost:
          "border-transparent bg-transparent text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10",
        outline:
          "border-primary-500 bg-primary-500/10 text-primary-600 hover:border-primary-600 hover:bg-primary-500/20 hover:text-primary-700",
        danger:
          "border-danger-500 bg-danger-500 text-white hover:border-danger-600 hover:bg-danger-600",
        dangernormal:
          "border-neutral-300 bg-transparent text-neutral-700 hover:border-danger-600 hover:bg-danger-600 hover:text-white dark:border-white/10",
        success:
          "border-success-500 bg-success-500 text-white hover:border-success-600 hover:bg-success-600",
        successnormal:
          "border-neutral-300 bg-transparent text-neutral-700 hover:border-success-600 hover:bg-success-600 hover:text-white dark:border-white/10",
        primarynormal:
          "border-neutral-300 bg-transparent text-neutral-700 hover:border-primary-600 hover:bg-primary-600 hover:text-white dark:border-white/10",
      },
      size: {
        xss: "h-7 px-2 text-xs",
        xs: "h-9 px-3 text-xs",
        sm: "h-10 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-14 px-8 text-base",
      },
      iconOnly: {
        true: "px-0",
        false: "",
      },
    },
    compoundVariants: [
      { iconOnly: true, size: "xss", className: "w-7" },
      { iconOnly: true, size: "xs", className: "w-9" },
      { iconOnly: true, size: "sm", className: "w-10" },
      { iconOnly: true, size: "md", className: "w-11" },
      { iconOnly: true, size: "lg", className: "w-14" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
      iconOnly: false,
    },
  },
);

const SPINNER_SIZE = {
  xss: "h-3 w-3 border",
  xs: "h-3.5 w-3.5 border",
  sm: "h-4 w-4 border-2",
  md: "h-4 w-4 border-2",
  lg: "h-5 w-5 border-2",
} as const;

const LIGHT_SPINNER_VARIANTS = new Set(["secondary", "normal", "ghost", "outline"]);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, "iconOnly"> {
  /** Shows a spinner and disables the button (TMS BaseButton `loading`). */
  loading?: boolean;
  /** Replaces the label while loading (TMS BaseButton `loadingText`). */
  loadingText?: React.ReactNode;
  /** Optional icon element rendered beside the label. */
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      loadingText,
      icon,
      iconPosition = "left",
      disabled,
      children,
      type,
      ...props
    },
    ref,
  ) => {
    const resolvedSize = size ?? "md";
    const label = loading && loadingText ? loadingText : children;
    const iconOnly = !label && !!icon;
    const spinner = (
      <span
        aria-hidden="true"
        className={cn(
          "inline-block shrink-0 animate-spin rounded-full",
          SPINNER_SIZE[resolvedSize],
          LIGHT_SPINNER_VARIANTS.has(variant ?? "primary")
            ? "border-neutral-400/30 border-t-neutral-600"
            : "border-white/30 border-t-white",
        )}
      />
    );

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size, iconOnly }), className)}
        {...props}
      >
        {iconPosition === "left" ? (loading ? spinner : icon) : null}
        {label}
        {iconPosition === "right" ? (loading ? spinner : icon) : null}
      </button>
    );
  },
);
Button.displayName = "Button";

/** TMS naming alias — `BaseButton` and `Button` are the same component. */
export const BaseButton = Button;

export { buttonVariants };
