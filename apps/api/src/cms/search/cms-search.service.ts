import { Injectable } from "@nestjs/common";
import type { CmsContentType } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";

const EXCERPT_LENGTH = 200;
const PER_SOURCE_CAP = 50;

interface SearchHit {
  contentType: CmsContentType;
  contentId: string;
  title: string;
  excerpt: string;
  createdAt: Date;
}

function excerptOf(text: string): string {
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;
}

/**
 * Keyword search over published CMS content (ADR-0022 §6), mirroring
 * CommunitySearchService's MVP shape: Prisma `contains`/`mode: "insensitive"`,
 * no full-text index or relevance ranking (same class of gap as TD-031).
 * Scoped to Pages/FAQ/Announcements — Banners are images/links, not searchable
 * text content.
 */
@Injectable()
export class CmsSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: { q: string; page: number; pageSize: number }) {
    const [pages, faqItems, announcements] = await Promise.all([
      this.prisma.cmsPage.findMany({
        where: {
          status: "PUBLISHED",
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { body: { contains: params.q, mode: "insensitive" } },
          ],
        },
        orderBy: { publishedAt: "desc" },
        take: PER_SOURCE_CAP,
      }),
      this.prisma.cmsFaqItem.findMany({
        where: {
          status: "PUBLISHED",
          OR: [
            { question: { contains: params.q, mode: "insensitive" } },
            { answer: { contains: params.q, mode: "insensitive" } },
          ],
        },
        orderBy: { publishedAt: "desc" },
        take: PER_SOURCE_CAP,
      }),
      this.prisma.cmsAnnouncement.findMany({
        where: {
          status: "PUBLISHED",
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { body: { contains: params.q, mode: "insensitive" } },
          ],
        },
        orderBy: { publishedAt: "desc" },
        take: PER_SOURCE_CAP,
      }),
    ]);

    const hits: SearchHit[] = [
      ...pages.map((page) => ({
        contentType: "PAGE" as const,
        contentId: page.id,
        title: page.title,
        excerpt: excerptOf(page.body),
        createdAt: page.publishedAt ?? page.createdAt,
      })),
      ...faqItems.map((item) => ({
        contentType: "FAQ" as const,
        contentId: item.id,
        title: item.question,
        excerpt: excerptOf(item.answer),
        createdAt: item.publishedAt ?? item.createdAt,
      })),
      ...announcements.map((item) => ({
        contentType: "ANNOUNCEMENT" as const,
        contentId: item.id,
        title: item.title,
        excerpt: excerptOf(item.body),
        createdAt: item.publishedAt ?? item.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = hits.length;
    const start = (params.page - 1) * params.pageSize;
    const items = hits
      .slice(start, start + params.pageSize)
      .map(({ createdAt: _createdAt, ...rest }) => rest);
    return { items, total };
  }
}
