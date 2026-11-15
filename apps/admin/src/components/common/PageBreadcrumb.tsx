import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbCrumb {
  label: string;
  /** Omit for a non-navigable section label (e.g. a sidebar group). */
  href?: string;
}

/**
 * TMS `common/PageBreadcrumb.vue` — the "Home › … › Page" trail. Used on
 * its own or via PageHeader, which pairs it with the page title.
 */
export function BreadcrumbTrail({
  pageTitle,
  trail = [],
  homeHref = "/dashboard",
}: {
  pageTitle: string;
  trail?: BreadcrumbCrumb[];
  homeHref?: string;
}) {
  const crumbs: BreadcrumbCrumb[] = [{ label: "Home", href: homeHref }, ...trail];
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((crumb) => (
          <li
            key={`${crumb.label}-${crumb.href ?? ""}`}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400"
          >
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-neutral-700">
                {crumb.label}
              </Link>
            ) : (
              <span>{crumb.label}</span>
            )}
            <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </li>
        ))}
        <li
          className="max-w-[16rem] truncate text-sm text-neutral-800 dark:text-white/90"
          aria-current="page"
        >
          {pageTitle}
        </li>
      </ol>
    </nav>
  );
}

/** TMS `common/PageBreadcrumb.vue` — page title on the left, breadcrumb trail on the right. */
export function PageBreadcrumb({
  pageTitle,
  trail,
  homeHref,
}: {
  pageTitle: string;
  trail?: BreadcrumbCrumb[];
  homeHref?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-neutral-800 dark:text-white/90">{pageTitle}</h2>
      <BreadcrumbTrail pageTitle={pageTitle} trail={trail} homeHref={homeHref} />
    </div>
  );
}
