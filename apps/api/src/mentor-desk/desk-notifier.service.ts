import { Injectable } from "@nestjs/common";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

/** Notifications the mentor module sends (to admins, mentors and students). */
@Injectable()
export class DeskNotifier {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async admins(eventType: string, title: string, body: string, data: Record<string, unknown> = {}) {
    const admins = await this.prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: { name: "ADMINISTRATOR" } } } },
      select: { id: true },
    });
    for (const a of admins) {
      await this.user(a.id, eventType, title, body, data);
    }
  }

  async user(
    userId: string,
    eventType: string,
    title: string,
    body: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    await this.notifications
      .enqueue({ userId, eventType, category: "platform", title, body, data })
      .catch(() => undefined);
  }
}
