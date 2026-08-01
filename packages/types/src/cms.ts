/**
 * CMS & Publishing Workflow DTOs (Sprint 12, ADR-0022). Draft -> Review ->
 * Approval -> Publish -> Archive, with version history and a media library,
 * for five content types: Landing Pages, Static Pages, FAQ, Announcements,
 * Banners.
 */

export const CMS_CONTENT_TYPES = ["PAGE", "FAQ", "ANNOUNCEMENT", "BANNER"] as const;
export type CmsContentType = (typeof CMS_CONTENT_TYPES)[number];

export const CMS_PAGE_TYPES = ["LANDING", "STATIC"] as const;
export type CmsPageType = (typeof CMS_PAGE_TYPES)[number];

export const CMS_WORKFLOW_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type CmsWorkflowStatus = (typeof CMS_WORKFLOW_STATUSES)[number];

export interface CmsAssetDto {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: "PENDING" | "CLEAN" | "INFECTED" | "FAILED";
  altText: string | null;
  uploadedByEmail: string;
  usageCount: number;
  createdAt: string;
}

export interface CmsPageDto {
  id: string;
  pageType: CmsPageType;
  slug: string;
  title: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  status: CmsWorkflowStatus;
  version: number;
  scheduledPublishAt: string | null;
  scheduledUnpublishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsFaqItemDto {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  position: number;
  status: CmsWorkflowStatus;
  version: number;
  scheduledPublishAt: string | null;
  scheduledUnpublishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsAnnouncementDto {
  id: string;
  title: string;
  body: string;
  status: CmsWorkflowStatus;
  version: number;
  scheduledPublishAt: string | null;
  scheduledUnpublishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsBannerDto {
  id: string;
  title: string;
  imageAssetId: string | null;
  linkUrl: string | null;
  placement: string;
  position: number;
  status: CmsWorkflowStatus;
  version: number;
  scheduledPublishAt: string | null;
  scheduledUnpublishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsContentVersionDto {
  id: string;
  contentType: CmsContentType;
  contentId: string;
  versionNumber: number;
  snapshot: Record<string, unknown>;
  status: CmsWorkflowStatus;
  changeNote: string | null;
  createdByEmail: string;
  createdAt: string;
}

/** Field-level before/after for two versions, produced by CmsVersioningService.compareVersions(). */
export interface CmsVersionDiffEntry {
  field: string;
  before: unknown;
  after: unknown;
}

export interface CmsSearchResultDto {
  contentType: CmsContentType;
  contentId: string;
  title: string;
  excerpt: string;
}
