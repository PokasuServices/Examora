import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** A browser's Web Push subscription (VAPID) — ADR-0019 §6. One user may have several (per device). */
@Injectable()
export class WebPushSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(userId: string, params: { endpoint: string; p256dh: string; auth: string }) {
    return this.prisma.webPushSubscription.upsert({
      where: { endpoint: params.endpoint },
      create: { userId, endpoint: params.endpoint, p256dh: params.p256dh, auth: params.auth },
      update: { userId, p256dh: params.p256dh, auth: params.auth },
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.webPushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  async listMine(userId: string) {
    return this.prisma.webPushSubscription.findMany({ where: { userId } });
  }
}
