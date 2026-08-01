"use client";

import { useAuth } from "@examora/auth-client";
import type {
  CmsAnnouncementDto,
  CmsAssetDto,
  CmsBannerDto,
  CmsContentVersionDto,
  CmsFaqItemDto,
  CmsPageDto,
  CmsPageType,
  CmsVersionDiffEntry,
  CmsWorkflowStatus,
  PaginatedData,
} from "@examora/types";

interface CreatePageInput {
  pageType: CmsPageType;
  slug: string;
  title: string;
  body: string;
  seoTitle?: string;
  seoDescription?: string;
}
type UpdatePageInput = Partial<Omit<CreatePageInput, "pageType">>;

interface CreateFaqInput {
  question: string;
  answer: string;
  category?: string;
  position?: number;
}
type UpdateFaqInput = Partial<CreateFaqInput>;

interface CreateAnnouncementInput {
  title: string;
  body: string;
}
type UpdateAnnouncementInput = Partial<CreateAnnouncementInput>;

interface CreateBannerInput {
  title: string;
  imageAssetId?: string | null;
  linkUrl?: string;
  placement: string;
  position?: number;
}
type UpdateBannerInput = Partial<CreateBannerInput>;

/** Typed wrappers over the CMS & Publishing Workflow admin endpoints (cms:manage/cms:publish, ADR-0022). */
export function useCmsApi() {
  const { request } = useAuth();

  function versionEndpoints<T>(base: string) {
    return {
      listVersions: (id: string) =>
        request<CmsContentVersionDto[]>(`${base}/${id}/versions`, { method: "GET" }),
      compareVersions: (id: string, from: number, to: number) =>
        request<CmsVersionDiffEntry[]>(`${base}/${id}/versions/compare?from=${from}&to=${to}`, {
          method: "GET",
        }),
      restoreVersion: (id: string, versionNumber: number) =>
        request<T>(`${base}/${id}/versions/${versionNumber}/restore`, { method: "POST" }),
      transition: (id: string, targetStatus: CmsWorkflowStatus) =>
        request<T>(`${base}/${id}/transition`, { method: "POST", body: { targetStatus } }),
      schedulePublish: (id: string, at: string) =>
        request<T>(`${base}/${id}/schedule-publish`, { method: "POST", body: { at } }),
      scheduleUnpublish: (id: string, at: string) =>
        request<T>(`${base}/${id}/schedule-unpublish`, { method: "POST", body: { at } }),
    };
  }

  return {
    pages: {
      list: (
        params: {
          page?: number;
          pageSize?: number;
          pageType?: CmsPageType;
          status?: CmsWorkflowStatus;
        } = {},
      ) =>
        request<PaginatedData<CmsPageDto>>(`/admin/cms/pages?${toQuery(params)}`, {
          method: "GET",
        }),
      get: (id: string) => request<CmsPageDto>(`/admin/cms/pages/${id}`, { method: "GET" }),
      create: (input: CreatePageInput) =>
        request<CmsPageDto>("/admin/cms/pages", { method: "POST", body: input }),
      update: (id: string, input: UpdatePageInput) =>
        request<CmsPageDto>(`/admin/cms/pages/${id}`, { method: "PATCH", body: input }),
      ...versionEndpoints<CmsPageDto>("/admin/cms/pages"),
    },
    faq: {
      list: (params: { page?: number; pageSize?: number; status?: CmsWorkflowStatus } = {}) =>
        request<PaginatedData<CmsFaqItemDto>>(`/admin/cms/faq?${toQuery(params)}`, {
          method: "GET",
        }),
      get: (id: string) => request<CmsFaqItemDto>(`/admin/cms/faq/${id}`, { method: "GET" }),
      create: (input: CreateFaqInput) =>
        request<CmsFaqItemDto>("/admin/cms/faq", { method: "POST", body: input }),
      update: (id: string, input: UpdateFaqInput) =>
        request<CmsFaqItemDto>(`/admin/cms/faq/${id}`, { method: "PATCH", body: input }),
      ...versionEndpoints<CmsFaqItemDto>("/admin/cms/faq"),
    },
    announcements: {
      list: (params: { page?: number; pageSize?: number; status?: CmsWorkflowStatus } = {}) =>
        request<PaginatedData<CmsAnnouncementDto>>(`/admin/cms/announcements?${toQuery(params)}`, {
          method: "GET",
        }),
      get: (id: string) =>
        request<CmsAnnouncementDto>(`/admin/cms/announcements/${id}`, { method: "GET" }),
      create: (input: CreateAnnouncementInput) =>
        request<CmsAnnouncementDto>("/admin/cms/announcements", { method: "POST", body: input }),
      update: (id: string, input: UpdateAnnouncementInput) =>
        request<CmsAnnouncementDto>(`/admin/cms/announcements/${id}`, {
          method: "PATCH",
          body: input,
        }),
      ...versionEndpoints<CmsAnnouncementDto>("/admin/cms/announcements"),
    },
    banners: {
      list: (
        params: {
          page?: number;
          pageSize?: number;
          status?: CmsWorkflowStatus;
          placement?: string;
        } = {},
      ) =>
        request<PaginatedData<CmsBannerDto>>(`/admin/cms/banners?${toQuery(params)}`, {
          method: "GET",
        }),
      get: (id: string) => request<CmsBannerDto>(`/admin/cms/banners/${id}`, { method: "GET" }),
      create: (input: CreateBannerInput) =>
        request<CmsBannerDto>("/admin/cms/banners", { method: "POST", body: input }),
      update: (id: string, input: UpdateBannerInput) =>
        request<CmsBannerDto>(`/admin/cms/banners/${id}`, { method: "PATCH", body: input }),
      ...versionEndpoints<CmsBannerDto>("/admin/cms/banners"),
    },
    assets: {
      list: (params: { page?: number; pageSize?: number } = {}) =>
        request<PaginatedData<CmsAssetDto>>(`/admin/cms/assets?${toQuery(params)}`, {
          method: "GET",
        }),
      presign: (input: { fileName: string; mimeType: string; sizeBytes: number }) =>
        request<{ url: string; key: string }>("/admin/cms/assets/presign", {
          method: "POST",
          body: input,
        }),
      confirm: (input: {
        storageKey: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        altText?: string;
      }) => request<CmsAssetDto>("/admin/cms/assets/confirm", { method: "POST", body: input }),
      getDownloadUrl: (id: string) =>
        request<{ url: string }>(`/admin/cms/assets/${id}/download-url`, { method: "GET" }),
      remove: (id: string) => request<void>(`/admin/cms/assets/${id}`, { method: "DELETE" }),
    },
  };
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return search.toString();
}
