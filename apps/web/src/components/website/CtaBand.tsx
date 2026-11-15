import Link from "next/link";
import { buttonVariants, cn } from "@examora/ui";
import { CommonGridShape } from "@/components/common/CommonGridShape";

/** Closing call to action — same brand-panel treatment as the hero. */
export function CtaBand() {
  return (
    <section className="bg-white dark:bg-neutral-900 py-16 lg:py-24">
      <div className="mx-auto max-w-screen-xl px-4 md:px-6">
        <div className="relative z-1 overflow-hidden rounded-2xl bg-primary-700 px-6 py-14 text-center sm:px-12">
          <CommonGridShape />
          <h2 className="mx-auto max-w-2xl text-title-sm font-bold text-white">
            Ready to start preparing?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-primary-100">
            Create your free account and explore the courses, quizzes and community today.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
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
        </div>
      </div>
    </section>
  );
}
