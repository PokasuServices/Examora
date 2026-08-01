import { Controller, Get, Param, ParseEnumPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CMS_PAGE_TYPES,
  type CmsAnnouncementDto,
  type CmsBannerDto,
  type CmsFaqItemDto,
  type CmsPageDto,
  type CmsPageType,
  type CmsSearchResultDto,
} from "@examora/types";
import { Public } from "../common/decorators/public.decorator";
import { toCmsAnnouncementDto, toCmsBannerDto, toCmsFaqItemDto, toCmsPageDto } from "./cms.mappers";
import { SearchCmsContentQueryDto } from "./dto/search-cms-content-query.dto";
import { CmsAnnouncementsService } from "./announcements/cms-announcements.service";
import { CmsBannersService } from "./banners/cms-banners.service";
import { CmsFaqService } from "./faq/cms-faq.service";
import { CmsPagesService } from "./pages/cms-pages.service";
import { CmsSearchService } from "./search/cms-search.service";

/**
 * Public reads for PUBLISHED CMS content (ADR-0022 §1, §6) — marketing
 * pages/FAQ/announcements/banners for logged-out visitors, mirroring the
 * `@Public()` opt-out pattern already used for auth/health/webhooks. Every
 * method here is a thin pass-through to a service method that itself only
 * ever returns PUBLISHED rows.
 */
@ApiTags("cms: public")
@Controller("cms")
@Public()
export class CmsPublicController {
  constructor(
    private readonly pagesService: CmsPagesService,
    private readonly faqService: CmsFaqService,
    private readonly announcementsService: CmsAnnouncementsService,
    private readonly bannersService: CmsBannersService,
    private readonly searchService: CmsSearchService,
  ) {}

  @Get("pages")
  @ApiOperation({ summary: "List published pages of a given type" })
  async listPages(
    @Query("pageType", new ParseEnumPipe(CMS_PAGE_TYPES)) pageType: CmsPageType,
  ): Promise<CmsPageDto[]> {
    const pages = await this.pagesService.listPublished(pageType);
    return pages.map(toCmsPageDto);
  }

  @Get("pages/:slug")
  @ApiOperation({ summary: "Get a published page by slug" })
  async getPageBySlug(@Param("slug") slug: string): Promise<CmsPageDto> {
    return toCmsPageDto(await this.pagesService.findPublishedBySlugOrThrow(slug));
  }

  @Get("faq")
  @ApiOperation({ summary: "List published FAQ items" })
  async listFaq(): Promise<CmsFaqItemDto[]> {
    const items = await this.faqService.listPublished();
    return items.map(toCmsFaqItemDto);
  }

  @Get("announcements")
  @ApiOperation({ summary: "List published announcements" })
  async listAnnouncements(): Promise<CmsAnnouncementDto[]> {
    const items = await this.announcementsService.listPublished();
    return items.map(toCmsAnnouncementDto);
  }

  @Get("banners")
  @ApiOperation({ summary: "List published banners, optionally filtered by placement" })
  async listBanners(@Query("placement") placement?: string): Promise<CmsBannerDto[]> {
    const items = await this.bannersService.listPublished(placement);
    return items.map(toCmsBannerDto);
  }

  @Get("search")
  @ApiOperation({ summary: "Keyword search across published pages/FAQ/announcements" })
  async search(
    @Query() query: SearchCmsContentQueryDto,
  ): Promise<{ items: CmsSearchResultDto[]; page: number; pageSize: number; total: number }> {
    const { items, total } = await this.searchService.search(query);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }
}
