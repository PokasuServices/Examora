import Link from "next/link";
import type { CmsWorkflowStatus } from "@examora/types";
import { Chip } from "@/components/ui/chip";
import { statusLabel } from "@/components/orders/format";
import { cmsStatusTone } from "./format";

interface CmsListItemBase {
  id: string;
  status: CmsWorkflowStatus;
  version: number;
  updatedAt: string;
  scheduledPublishAt: string | null;
  scheduledUnpublishAt: string | null;
}

export function CmsListTable<T extends CmsListItemBase>({
  items,
  getTitle,
  itemHref,
}: {
  items: T[];
  getTitle: (item: T) => string;
  itemHref: (item: T) => string;
}) {
  return (
    <div className="overflow-x-auto contain-layout">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-neutral-50 dark:bg-white/[0.03]">
          <tr>
            <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Title
            </th>
            <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Status
            </th>
            <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Version
            </th>
            <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Updated
            </th>
            <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Scheduled
            </th>
            <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.03]">
              <td className="max-w-xs truncate px-4 py-3 font-medium text-neutral-800 dark:text-white/90">
                {getTitle(item)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <Chip tone={cmsStatusTone(item.status)}>{statusLabel(item.status)}</Chip>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">
                v{item.version}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">
                {new Date(item.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                {item.scheduledPublishAt
                  ? `Publish ${new Date(item.scheduledPublishAt).toLocaleDateString()}`
                  : item.scheduledUnpublishAt
                    ? `Unpublish ${new Date(item.scheduledUnpublishAt).toLocaleDateString()}`
                    : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <Link
                  href={itemHref(item)}
                  className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Open →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
