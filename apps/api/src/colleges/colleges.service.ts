import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  COLLEGE_CATEGORIES,
  type AdminCollege,
  type AdminWebinar,
  type CollegeCategory,
  type CollegeDetail,
  type CollegeEnquiryView,
  type CollegeSummary,
  type WebinarDetail,
  type WebinarSummary,
} from "@examora/types";
import { PrismaService } from "../prisma/prisma.service";

const MEDIA_REF = /^media:[0-9a-f-]{36}$/i;

export function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "item"
  );
}

function assertImageRef(field: string, value: string | null | undefined): void {
  if (!value) return;
  if (!MEDIA_REF.test(value) && !/^https:\/\/\S+$/i.test(value)) {
    throw new BadRequestException(`${field} must be an https URL or an uploaded image`);
  }
}

const asCategories = (list: string[]): CollegeCategory[] =>
  list.filter((c): c is CollegeCategory => (COLLEGE_CATEGORIES as readonly string[]).includes(c));

export interface CollegeInput {
  name: string;
  city: string;
  categories: string[];
  logoUrl?: string | null;
  applicationFee?: number | null;
  website?: string | null;
  description?: string | null;
  published?: boolean;
  position?: number;
}

export interface WebinarInput {
  title: string;
  collegeId?: string | null;
  description?: string | null;
  bannerUrl?: string | null;
  startsAt: string;
  endsAt: string;
  joinUrl?: string | null;
  published?: boolean;
}

/** Explore Colleges and webinars (student module redesign, phase 8). */
@Injectable()
export class CollegesService {
  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------------------- student

  async list(userId: string, category?: string): Promise<CollegeSummary[]> {
    const rows = await this.prisma.college.findMany({
      where: {
        published: true,
        ...(category && (COLLEGE_CATEGORIES as readonly string[]).includes(category)
          ? { categories: { has: category } }
          : {}),
      },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { shortlists: { where: { userId }, select: { userId: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      categories: asCategories(c.categories),
      logoUrl: c.logoUrl,
      applicationFee: c.applicationFee,
      shortlisted: c.shortlists.length > 0,
    }));
  }

  private toWebinarSummary(
    w: {
      id: string;
      title: string;
      slug: string;
      bannerUrl: string | null;
      startsAt: Date;
      endsAt: Date;
      college: { name: string } | null;
      registrations: { userId: string }[];
    },
    userId: string,
  ): WebinarSummary {
    return {
      id: w.id,
      title: w.title,
      slug: w.slug,
      collegeName: w.college?.name ?? null,
      bannerUrl: w.bannerUrl,
      startsAt: w.startsAt.toISOString(),
      endsAt: w.endsAt.toISOString(),
      registered: w.registrations.some((r) => r.userId === userId),
    };
  }

  async detail(userId: string, slug: string): Promise<CollegeDetail> {
    const c = await this.prisma.college.findFirst({
      where: { slug, published: true },
      include: {
        shortlists: { where: { userId }, select: { userId: true } },
        enquiries: { where: { userId }, select: { id: true } },
        webinars: {
          where: { published: true, endsAt: { gte: new Date() } },
          orderBy: { startsAt: "asc" },
          include: {
            college: { select: { name: true } },
            registrations: { where: { userId }, select: { userId: true } },
          },
        },
      },
    });
    if (!c) throw new NotFoundException("College not found");
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      categories: asCategories(c.categories),
      logoUrl: c.logoUrl,
      applicationFee: c.applicationFee,
      shortlisted: c.shortlists.length > 0,
      website: c.website,
      description: c.description,
      enquired: c.enquiries.length > 0,
      webinars: c.webinars.map((w) => this.toWebinarSummary(w, userId)),
    };
  }

  private async publishedCollege(id: string) {
    const c = await this.prisma.college.findFirst({
      where: { id, published: true },
      select: { id: true },
    });
    if (!c) throw new NotFoundException("College not found");
  }

  async setShortlisted(userId: string, collegeId: string, on: boolean): Promise<void> {
    await this.publishedCollege(collegeId);
    if (on) {
      await this.prisma.collegeShortlist.upsert({
        where: { userId_collegeId: { userId, collegeId } },
        create: { userId, collegeId },
        update: {},
      });
    } else {
      await this.prisma.collegeShortlist.deleteMany({ where: { userId, collegeId } });
    }
  }

  async enquire(userId: string, collegeId: string, message?: string): Promise<void> {
    await this.publishedCollege(collegeId);
    const open = await this.prisma.collegeEnquiry.findFirst({
      where: { userId, collegeId, status: "NEW" },
      select: { id: true },
    });
    if (open)
      throw new ConflictException("You've already enquired; the college team will be in touch");
    await this.prisma.collegeEnquiry.create({
      data: { userId, collegeId, message: message?.trim() || null },
    });
  }

  async shortlist(userId: string): Promise<CollegeSummary[]> {
    return (await this.list(userId)).filter((c) => c.shortlisted);
  }

  async webinars(userId: string): Promise<WebinarSummary[]> {
    const rows = await this.prisma.webinar.findMany({
      where: { published: true, endsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      include: {
        college: { select: { name: true } },
        registrations: { where: { userId }, select: { userId: true } },
      },
    });
    return rows.map((w) => this.toWebinarSummary(w, userId));
  }

  async webinar(userId: string, slug: string): Promise<WebinarDetail> {
    const w = await this.prisma.webinar.findFirst({
      where: { slug, published: true },
      include: {
        college: { select: { name: true } },
        registrations: { select: { userId: true } },
      },
    });
    if (!w) throw new NotFoundException("Webinar not found");
    const summary = this.toWebinarSummary(w, userId);
    return {
      ...summary,
      description: w.description,
      collegeId: w.collegeId,
      joinUrl: summary.registered ? w.joinUrl : null,
      registrations: w.registrations.length,
    };
  }

  async setRegistered(userId: string, webinarId: string, on: boolean): Promise<void> {
    const w = await this.prisma.webinar.findFirst({
      where: { id: webinarId, published: true },
      select: { endsAt: true },
    });
    if (!w) throw new NotFoundException("Webinar not found");
    if (on) {
      if (w.endsAt < new Date()) throw new BadRequestException("This webinar has ended");
      await this.prisma.webinarRegistration.upsert({
        where: { webinarId_userId: { webinarId, userId } },
        create: { webinarId, userId },
        update: {},
      });
    } else {
      await this.prisma.webinarRegistration.deleteMany({ where: { webinarId, userId } });
    }
  }

  // --------------------------------------------------------------- admin

  async adminColleges(): Promise<AdminCollege[]> {
    const rows = await this.prisma.college.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { _count: { select: { enquiries: true, shortlists: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      categories: asCategories(c.categories),
      logoUrl: c.logoUrl,
      applicationFee: c.applicationFee,
      shortlisted: false,
      website: c.website,
      description: c.description,
      published: c.published,
      position: c.position,
      enquiryCount: c._count.enquiries,
      shortlistCount: c._count.shortlists,
    }));
  }

  private async uniqueSlug(model: "college" | "webinar", base: string, exceptId?: string) {
    let slug = slugifyName(base);
    for (let i = 2; ; i++) {
      const hit =
        model === "college"
          ? await this.prisma.college.findUnique({ where: { slug }, select: { id: true } })
          : await this.prisma.webinar.findUnique({ where: { slug }, select: { id: true } });
      if (!hit || hit.id === exceptId) return slug;
      slug = `${slugifyName(base)}-${i}`;
    }
  }

  async createCollege(dto: CollegeInput) {
    assertImageRef("logoUrl", dto.logoUrl);
    return this.prisma.college.create({
      data: {
        name: dto.name.trim(),
        slug: await this.uniqueSlug("college", dto.name),
        city: dto.city.trim(),
        categories: asCategories(dto.categories),
        logoUrl: dto.logoUrl || null,
        applicationFee: dto.applicationFee ?? null,
        website: dto.website || null,
        description: dto.description || null,
        published: dto.published ?? true,
        position: dto.position ?? 0,
      },
    });
  }

  async updateCollege(id: string, dto: Partial<CollegeInput>) {
    const existing = await this.prisma.college.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("College not found");
    assertImageRef("logoUrl", dto.logoUrl);
    return this.prisma.college.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        slug: dto.name ? await this.uniqueSlug("college", dto.name, id) : undefined,
        city: dto.city?.trim(),
        categories: dto.categories ? asCategories(dto.categories) : undefined,
        logoUrl: dto.logoUrl === undefined ? undefined : dto.logoUrl || null,
        applicationFee: dto.applicationFee,
        website: dto.website === undefined ? undefined : dto.website || null,
        description: dto.description === undefined ? undefined : dto.description || null,
        published: dto.published,
        position: dto.position,
      },
    });
  }

  async deleteCollege(id: string): Promise<void> {
    const existing = await this.prisma.college.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("College not found");
    await this.prisma.college.delete({ where: { id } });
  }

  async adminWebinars(): Promise<AdminWebinar[]> {
    const rows = await this.prisma.webinar.findMany({
      orderBy: { startsAt: "desc" },
      include: { college: { select: { name: true } }, _count: { select: { registrations: true } } },
    });
    return rows.map((w) => ({
      id: w.id,
      title: w.title,
      slug: w.slug,
      collegeName: w.college?.name ?? null,
      collegeId: w.collegeId,
      bannerUrl: w.bannerUrl,
      startsAt: w.startsAt.toISOString(),
      endsAt: w.endsAt.toISOString(),
      registered: false,
      description: w.description,
      joinUrl: w.joinUrl,
      registrations: w._count.registrations,
      published: w.published,
    }));
  }

  private assertWebinarTimes(startsAt: Date, endsAt: Date): void {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException("Enter valid start and end times");
    }
    if (endsAt <= startsAt) throw new BadRequestException("The webinar must end after it starts");
  }

  async createWebinar(dto: WebinarInput) {
    assertImageRef("bannerUrl", dto.bannerUrl);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.assertWebinarTimes(startsAt, endsAt);
    return this.prisma.webinar.create({
      data: {
        title: dto.title.trim(),
        slug: await this.uniqueSlug("webinar", dto.title),
        collegeId: dto.collegeId || null,
        description: dto.description || null,
        bannerUrl: dto.bannerUrl || null,
        startsAt,
        endsAt,
        joinUrl: dto.joinUrl || null,
        published: dto.published ?? true,
      },
    });
  }

  async updateWebinar(id: string, dto: Partial<WebinarInput>) {
    const existing = await this.prisma.webinar.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Webinar not found");
    assertImageRef("bannerUrl", dto.bannerUrl);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    this.assertWebinarTimes(startsAt, endsAt);
    return this.prisma.webinar.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        slug: dto.title ? await this.uniqueSlug("webinar", dto.title, id) : undefined,
        collegeId: dto.collegeId === undefined ? undefined : dto.collegeId || null,
        description: dto.description === undefined ? undefined : dto.description || null,
        bannerUrl: dto.bannerUrl === undefined ? undefined : dto.bannerUrl || null,
        startsAt,
        endsAt,
        joinUrl: dto.joinUrl === undefined ? undefined : dto.joinUrl || null,
        published: dto.published,
      },
    });
  }

  async deleteWebinar(id: string): Promise<void> {
    const existing = await this.prisma.webinar.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Webinar not found");
    await this.prisma.webinar.delete({ where: { id } });
  }

  async enquiries(): Promise<CollegeEnquiryView[]> {
    const rows = await this.prisma.collegeEnquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        college: { select: { name: true } },
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    return rows.map((e) => ({
      id: e.id,
      collegeName: e.college.name,
      studentName: `${e.user.firstName ?? ""} ${e.user.lastName ?? ""}`.trim() || e.user.email,
      studentEmail: e.user.email,
      message: e.message,
      status: e.status === "CONTACTED" ? "CONTACTED" : "NEW",
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async setEnquiryStatus(id: string, status: "NEW" | "CONTACTED"): Promise<void> {
    const e = await this.prisma.collegeEnquiry.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new NotFoundException("Enquiry not found");
    await this.prisma.collegeEnquiry.update({ where: { id }, data: { status } });
  }
}
