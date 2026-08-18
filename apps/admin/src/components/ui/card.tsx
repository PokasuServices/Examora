import * as React from "react";
import { cn } from "@examora/ui";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Compact padding (16px) for dense widgets vs. the default 24px for content cards. */
  density?: "default" | "compact";
  /** Adds the hover-lift micro-interaction (used for clickable cards). */
  interactive?: boolean;
}

/** Base surface for every card — 20px radius, hairline border, very soft shadow. Mirrors apps/web's Card exactly. */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, density = "default", interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-card border border-neutral-900/[0.06] bg-white shadow-soft",
        density === "default" ? "p-6" : "p-4",
        interactive &&
          "transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-soft-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";
