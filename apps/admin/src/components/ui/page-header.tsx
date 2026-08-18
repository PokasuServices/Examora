import type * as React from "react";

/**
 * Shared page-header pattern: title, optional subtitle, optional actions
 * slot aligned right. New — apps/web builds this inline per page, but
 * apps/admin has far more list pages sharing the exact same shape, so
 * centralizing it here keeps every page's header consistent by construction.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-bold text-neutral-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-neutral-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
