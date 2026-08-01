import { apiRequest } from "@examora/auth-client";
import type {
  CmsAnnouncementDto,
  CmsBannerDto,
  CmsFaqItemDto,
  CmsPageDto,
  CmsPageType,
  CmsSearchResultDto,
} from "@examora/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

/**
 * Public CMS reads (ADR-0022 §1, §6) — no auth token, since every one of
 * these endpoints is `@Public()` and only ever returns PUBLISHED content.
 * Unlike the other `use*Api()` hooks, this needs no `useAuth()` context.
 */
export const cmsPublicApi = {
  listPages: (pageType: CmsPageType) =>
    apiRequest<CmsPageDto[]>(`/cms/pages?pageType=${pageType}`, {
      baseUrl: API_BASE_URL,
      method: "GET",
    }),
  getPageBySlug: (slug: string) =>
    apiRequest<CmsPageDto>(`/cms/pages/${encodeURIComponent(slug)}`, {
      baseUrl: API_BASE_URL,
      method: "GET",
    }),
  listFaq: () => apiRequest<CmsFaqItemDto[]>("/cms/faq", { baseUrl: API_BASE_URL, method: "GET" }),
  listAnnouncements: () =>
    apiRequest<CmsAnnouncementDto[]>("/cms/announcements", {
      baseUrl: API_BASE_URL,
      method: "GET",
    }),
  listBanners: (placement?: string) =>
    apiRequest<CmsBannerDto[]>(
      `/cms/banners${placement ? `?placement=${encodeURIComponent(placement)}` : ""}`,
      {
        baseUrl: API_BASE_URL,
        method: "GET",
      },
    ),
  search: (q: string) =>
    apiRequest<{ items: CmsSearchResultDto[]; page: number; pageSize: number; total: number }>(
      `/cms/search?q=${encodeURIComponent(q)}`,
      { baseUrl: API_BASE_URL, method: "GET" },
    ),
};
