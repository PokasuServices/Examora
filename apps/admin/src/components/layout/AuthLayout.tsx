import Link from "next/link";
import { AppLogo } from "@/components/common/AppLogo";
import { CommonGridShape } from "@/components/common/CommonGridShape";
import { FullScreenLayout } from "./FullScreenLayout";

/**
 * TMS `layout/AuthLayout.vue` — split screen: brand panel (primary fill,
 * grid shapes, logo) on the left from `lg` up, form column on the right
 * with a large title and description above the slotted form.
 */
export function AuthLayout({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <FullScreenLayout>
      <div className="relative z-1 bg-white p-6 dark:bg-neutral-900 sm:p-0">
        <div className="relative flex min-h-screen w-full flex-col justify-center dark:bg-neutral-900 lg:flex-row">
          <div className="relative hidden h-auto w-full items-center bg-primary-700 dark:bg-white/5 lg:grid lg:w-1/2">
            <div className="z-1 flex items-center justify-center">
              <CommonGridShape />
              <div className="flex max-w-xs flex-col items-center text-center">
                <Link href="/" className="mb-4 block" aria-label="Examora home">
                  <AppLogo tone="light" size="lg" />
                </Link>
                <p className="text-sm text-white/70">
                  Platform administration — staff access only.
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-1 flex-col lg:w-1/2">
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
              <Link href="/" className="mb-8 block lg:hidden" aria-label="Examora home">
                <AppLogo />
              </Link>
              <div className="mb-5 sm:mb-8">
                {title ? (
                  <h1 className="mb-2 text-title-sm font-semibold text-neutral-800 dark:text-white/90 sm:text-title-md">
                    {title}
                  </h1>
                ) : null}
                {description ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
                ) : null}
              </div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </FullScreenLayout>
  );
}
