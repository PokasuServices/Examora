import { Injectable } from "@nestjs/common";
import type { NotificationDigestMode } from "@examora/types";
import { PrismaService } from "../prisma/prisma.service";

export interface UpdatePreferencesInput {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
  webPushEnabled?: boolean;
  inAppEnabled?: boolean;
  mutedCategories?: string[];
  dndStartMinute?: number | null;
  dndEndMinute?: number | null;
  digestMode?: NotificationDigestMode;
  language?: string;
  timezone?: string;
}

/** One row per user (COMM-MERGED §5, ADR-0019 §5) — created lazily on first read/write. */
@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    if (existing) {
      return existing;
    }
    return this.prisma.notificationPreference.create({ data: { userId } });
  }

  async update(userId: string, input: UpdatePreferencesInput) {
    await this.getOrCreate(userId);
    return this.prisma.notificationPreference.update({
      where: { userId },
      data: input,
    });
  }
}
