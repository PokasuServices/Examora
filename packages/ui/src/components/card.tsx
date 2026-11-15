import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Card surfaces — React ports of the TMS (TailAdmin) card pair:
 *
 * - `CardComponent` (TMS `cards/CardComponent.vue`): flat bordered panel
 *   with optional header (icon, title, subtitle, right-side actions),
 *   body and footer, each with its own class hook.
 * - `ComponentCard` (TMS `common/ComponentCard.vue`): titled section card
 *   with description and a padded, divided body.
 */

export interface CardComponentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
  /** Icon element rendered before the title. */
  headerIcon?: React.ReactNode;
  /** Right-aligned header content (TMS `#header` slot): buttons, filters, links. */
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  headerClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  showHeaderBorder?: boolean;
  noBodyPadding?: boolean;
  hideFooterBorder?: boolean;
}

export const CardComponent = React.forwardRef<HTMLDivElement, CardComponentProps>(
  (
    {
      title,
      subTitle,
      headerIcon,
      headerActions,
      footer,
      className,
      headerClassName,
      titleClassName,
      bodyClassName,
      footerClassName,
      showHeaderBorder = false,
      noBodyPadding = false,
      hideFooterBorder = false,
      children,
      ...props
    },
    ref,
  ) => {
    const hasHeader = !!title || !!headerActions;
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex flex-col rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-white/[0.03]",
          className,
        )}
        {...props}
      >
        {hasHeader ? (
          <div
            className={cn(
              "flex items-center gap-6 rounded-t-md px-4 pt-4",
              showHeaderBorder && "border-b border-neutral-200 pb-4 dark:border-neutral-800",
              headerClassName,
            )}
          >
            {title ? (
              <div
                className={cn(
                  "flex flex-1 items-center gap-2 text-lg font-medium text-neutral-800 dark:text-white/90",
                  titleClassName,
                )}
              >
                {headerIcon ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                    {headerIcon}
                  </span>
                ) : null}
                <div className="flex min-w-0 flex-col">
                  <h4 className="truncate">{title}</h4>
                  {subTitle ? (
                    <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
                      {subTitle}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex-1" />
            )}
            {headerActions ? (
              <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
            ) : null}
          </div>
        ) : null}

        <div className={cn(!noBodyPadding && "p-4", bodyClassName)}>{children}</div>

        {footer ? (
          <div
            className={cn(
              "flex px-4 pb-4 pt-4",
              !hideFooterBorder && "border-t border-neutral-200 dark:border-neutral-800",
              footerClassName,
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    );
  },
);
CardComponent.displayName = "CardComponent";

export interface ComponentCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  desc?: React.ReactNode;
  /** Right-aligned header content. */
  actions?: React.ReactNode;
  bodyClassName?: string;
}

export function ComponentCard({
  title,
  desc,
  actions,
  className,
  bodyClassName,
  children,
  ...props
}: ComponentCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-white/[0.03]",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div className="min-w-0">
          <h3 className="text-base font-medium text-neutral-800 dark:text-white/90">{title}</h3>
          {desc ? (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{desc}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div
        className={cn(
          "border-t border-neutral-100 p-4 dark:border-neutral-800 sm:p-6",
          bodyClassName,
        )}
      >
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  );
}
