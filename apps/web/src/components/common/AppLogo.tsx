import { cn } from "@examora/ui";

/**
 * Examora brand mark — plays the role of TMS's logo-dark / logo-icon
 * images: full wordmark or icon-only, on light or dark surfaces.
 */
export function AppLogo({
  variant = "full",
  tone = "dark",
  size = "md",
  className,
}: {
  variant?: "full" | "icon";
  /** "dark" = dark text for light surfaces; "light" = white text for the auth panel. */
  tone?: "dark" | "light";
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2 font-heading font-bold", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md",
          size === "lg" ? "h-11 w-11 text-lg" : "h-8 w-8 text-sm",
          tone === "light" ? "bg-white text-primary-700" : "bg-primary-600 text-white",
        )}
      >
        E
      </span>
      {variant === "full" ? (
        <span
          className={cn(
            size === "lg" ? "text-3xl" : "text-lg",
            tone === "light" ? "text-white" : "text-neutral-900 dark:text-white",
          )}
        >
          Examora
        </span>
      ) : null}
    </span>
  );
}
