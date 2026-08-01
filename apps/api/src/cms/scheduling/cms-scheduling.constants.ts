import type { CmsContentType } from "@examora/types";

export const CMS_SCHEDULING_QUEUE = "cms-scheduling";

export type CmsScheduledAction = "PUBLISH" | "UNPUBLISH";

export interface CmsSchedulingJobData {
  contentType: CmsContentType;
  contentId: string;
  action: CmsScheduledAction;
}

export function cmsSchedulingJobId(
  contentType: CmsContentType,
  contentId: string,
  action: CmsScheduledAction,
): string {
  return `${contentType}:${contentId}:${action}`;
}
