import * as React from "react";
import { cn } from "../lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid}
        className={cn(
          "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm text-neutral-900",
          "placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          invalid
            ? "border-error-500 focus-visible:ring-error-500"
            : "border-neutral-300 focus-visible:ring-primary-600",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  // Reusable primitive: callers pass htmlFor to associate it with a control.
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  <label ref={ref} className={cn("text-sm font-medium text-neutral-800", className)} {...props} />
));
Label.displayName = "Label";

export const FieldError = ({
  children,
}: {
  children?: React.ReactNode;
}): React.ReactElement | null => {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-error-600">
      {children}
    </p>
  );
};
