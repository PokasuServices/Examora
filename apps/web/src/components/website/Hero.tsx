import Link from "next/link";
import { CheckCircle2, ClipboardCheck, MessageSquareText, PlayCircle } from "lucide-react";
import { buttonVariants, cn } from "@examora/ui";
import { CommonGridShape } from "@/components/common/CommonGridShape";

/**
 * Illustrative product preview built from the app's own UI pieces (card,
 * progress bar, chips) — shows what the workspace looks like; not live data.
 */
function ProductPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-white/15 bg-white dark:bg-neutral-900 p-5 shadow-theme-xl">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            Continue learning
          </p>
          <span className="rounded-full bg-primary-50 dark:bg-primary-500/15 px-2.5 py-1 text-xs font-medium text-primary-700 dark:text-primary-300">
            In progress
          </span>
        </div>
        <p className="mt-3 text-base font-semibold text-neutral-800 dark:text-white/90">
          Quantitative Aptitude
        </p>
        <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
          Module 3 · Percentages &amp; Ratios
        </p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/5">
          <div className="h-full w-[62%] rounded-full bg-primary-600" />
        </div>
        <div className="mt-5 space-y-2.5">
          {[
            { icon: PlayCircle, label: "Lesson: Successive percentage change", done: true },
            { icon: ClipboardCheck, label: "Practice quiz · 15 questions", done: false },
            { icon: MessageSquareText, label: "Mentor feedback on your last test", done: false },
          ].map(({ icon: Icon, label, done }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"
            >
              <Icon
                size={18}
                strokeWidth={1.75}
                className="shrink-0 text-primary-600 dark:text-primary-400"
              />
              <span className="flex-1 truncate text-sm text-neutral-700 dark:text-neutral-300">
                {label}
              </span>
              {done ? <CheckCircle2 size={16} className="shrink-0 text-success-500" /> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-14 -right-4 hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 shadow-theme-lg sm:block">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Quiz result</p>
        <p className="text-lg font-semibold text-neutral-800 dark:text-white/90">
          Instant score <span className="text-success-600 dark:text-success-400">+ review</span>
        </p>
      </div>
    </div>
  );
}

/** Hero — TMS brand-panel treatment (primary fill + corner grid shapes), headline, CTAs, product preview. */
export function Hero({ banner }: { banner?: React.ReactNode }) {
  return (
    <section className="relative z-1 overflow-hidden bg-primary-700">
      <CommonGridShape />
      <div className="mx-auto grid max-w-screen-xl items-center gap-14 px-4 py-16 md:px-6 lg:grid-cols-2 lg:py-24">
        <div>
          {banner}
          <p className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary-100">
            Exam preparation &amp; mentoring platform
          </p>
          <h1 className="mt-5 text-title-sm font-bold text-white sm:text-title-md lg:text-[44px] lg:leading-[54px]">
            Prepare for your exams with structure, practice and a mentor by your side.
          </h1>
          <p className="mt-5 max-w-xl text-base text-primary-100 sm:text-lg">
            Examora brings courses, quizzes, assignments, mentoring and progress tracking together —
            so you always know what to study next.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "md" }),
                "border-white bg-white text-primary-700 hover:border-primary-50 hover:bg-primary-50",
              )}
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "normal", size: "md" }),
                "border-white/30 text-white hover:bg-white/10 dark:border-white/30 dark:text-white dark:hover:bg-white/10",
              )}
            >
              Log in
            </Link>
          </div>
          <p className="mt-4 text-sm text-primary-200">
            Sign up with email or Google. Free and paid courses available.
          </p>
        </div>
        <ProductPreview />
      </div>
    </section>
  );
}
