import type {
  CmsAnnouncementDto,
  CmsAssetDto,
  CmsBannerDto,
  CmsContentType,
  CmsContentVersionDto,
  CmsFaqItemDto,
  CmsPageDto,
  CmsPageType,
  CmsWorkflowStatus,
} from "@examora/types";

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

type CmsPageRow = {
  id: string;
  pageType: string;
  slug: string;
  title: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  status: string;
  version: number;
  scheduledPublishAt: Date | null;
  scheduledUnpublishAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toCmsPageDto(row: CmsPageRow): CmsPageDto {
  return {
    id: row.id,
    pageType: row.pageType as CmsPageType,
    slug: row.slug,
    title: row.title,
    body: row.body,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    status: row.status as CmsWorkflowStatus,
    version: row.version,
    scheduledPublishAt: iso(row.scheduledPublishAt),
    scheduledUnpublishAt: iso(row.scheduledUnpublishAt),
    publishedAt: iso(row.publishedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type CmsFaqItemRow = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  position: number;
  status: string;
  version: number;
  scheduledPublishAt: Date | null;
  scheduledUnpublishAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toCmsFaqItemDto(row: CmsFaqItemRow): CmsFaqItemDto {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    category: row.category,
    position: row.position,
    status: row.status as CmsWorkflowStatus,
    version: row.version,
    scheduledPublishAt: iso(row.scheduledPublishAt),
    scheduledUnpublishAt: iso(row.scheduledUnpublishAt),
    publishedAt: iso(row.publishedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type CmsAnnouncementRow = {
  id: string;
  title: string;
  body: string;
  status: string;
  version: number;
  scheduledPublishAt: Date | null;
  scheduledUnpublishAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toCmsAnnouncementDto(row: CmsAnnouncementRow): CmsAnnouncementDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status as CmsWorkflowStatus,
    version: row.version,
    scheduledPublishAt: iso(row.scheduledPublishAt),
    scheduledUnpublishAt: iso(row.scheduledUnpublishAt),
    publishedAt: iso(row.publishedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type CmsBannerRow = {
  id: string;
  title: string;
  imageAssetId: string | null;
  linkUrl: string | null;
  placement: string;
  position: number;
  status: string;
  version: number;
  scheduledPublishAt: Date | null;
  scheduledUnpublishAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toCmsBannerDto(row: CmsBannerRow): CmsBannerDto {
  return {
    id: row.id,
    title: row.title,
    imageAssetId: row.imageAssetId,
    linkUrl: row.linkUrl,
    placement: row.placement,
    position: row.position,
    status: row.status as CmsWorkflowStatus,
    version: row.version,
    scheduledPublishAt: iso(row.scheduledPublishAt),
    scheduledUnpublishAt: iso(row.scheduledUnpublishAt),
    publishedAt: iso(row.publishedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type CmsAssetRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: string;
  altText: string | null;
  createdAt: Date;
  uploadedBy: { email: string };
  _count: { usages: number };
};

export function toCmsAssetDto(row: CmsAssetRow): CmsAssetDto {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    scanStatus: row.scanStatus as CmsAssetDto["scanStatus"],
    altText: row.altText,
    uploadedByEmail: row.uploadedBy.email,
    usageCount: row._count.usages,
    createdAt: row.createdAt.toISOString(),
  };
}

type CmsContentVersionRow = {
  id: string;
  contentType: string;
  contentId: string;
  versionNumber: number;
  snapshot: unknown;
  status: string;
  changeNote: string | null;
  createdAt: Date;
  createdBy: { email: string };
};

export function toCmsContentVersionDto(row: CmsContentVersionRow): CmsContentVersionDto {
  return {
    id: row.id,
    contentType: row.contentType as CmsContentType,
    contentId: row.contentId,
    versionNumber: row.versionNumber,
    snapshot: row.snapshot as Record<string, unknown>,
    status: row.status as CmsWorkflowStatus,
    changeNote: row.changeNote,
    createdByEmail: row.createdBy.email,
    createdAt: row.createdAt.toISOString(),
  };
}
