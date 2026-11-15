import { cn } from "@examora/ui";

/** Centered section heading used across the website: eyebrow, title, description. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-title-sm font-bold text-neutral-800 dark:text-white/90">{title}</h2>
      {description ? (
        <p className="mt-4 text-base text-neutral-500 dark:text-neutral-400">{description}</p>
      ) : null}
    </div>
  );
}
