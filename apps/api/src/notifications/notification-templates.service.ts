import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { NotificationChannel } from "@examora/types";
import { PrismaService } from "../prisma/prisma.service";

export interface UpsertTemplateInput {
  eventType: string;
  channel: NotificationChannel;
  subject?: string;
  bodyTemplate: string;
  isActive?: boolean;
}

/**
 * Reusable, per-(event, channel) content with `{{placeholder}}` variables
 * (COMM-MERGED §4, ADR-0019). Templates are an optional customization layer
 * — `NotificationsService` falls back to the notification's own title/body
 * when no active template exists for an (eventType, channel) pair, so
 * bootstrapping a new event never requires seeding a template first.
 */
@Injectable()
export class NotificationTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: UpsertTemplateInput) {
    const clash = await this.prisma.notificationTemplate.findUnique({
      where: { eventType_channel: { eventType: input.eventType, channel: input.channel } },
    });
    if (clash) {
      throw new ConflictException(
        `A template for event "${input.eventType}" on channel ${input.channel} already exists`,
      );
    }
    return this.prisma.notificationTemplate.create({
      data: {
        eventType: input.eventType,
        channel: input.channel,
        subject: input.subject,
        bodyTemplate: input.bodyTemplate,
        isActive: input.isActive ?? true,
      },
    });
  }

  async update(id: string, input: Partial<Omit<UpsertTemplateInput, "eventType" | "channel">>) {
    await this.findByIdOrThrow(id);
    return this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        subject: input.subject,
        bodyTemplate: input.bodyTemplate,
        isActive: input.isActive,
      },
    });
  }

  async list(params: { page: number; pageSize: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationTemplate.findMany({
        orderBy: [{ eventType: "asc" }, { channel: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.notificationTemplate.count(),
    ]);
    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const template = await this.prisma.notificationTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException("Notification template not found");
    }
    return template;
  }

  /** Active template for (eventType, channel), or null if none exists (caller falls back to raw content). */
  async findActive(eventType: string, channel: NotificationChannel) {
    return this.prisma.notificationTemplate.findFirst({
      where: { eventType, channel, isActive: true },
    });
  }

  /** Replaces `{{key}}` placeholders with `data[key]` (missing keys left as-is). */
  render(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
      key in data ? String(data[key]) : match,
    );
  }
}
