import { Injectable } from "@nestjs/common";
import type {
  AdminEnrollmentAnalytics,
  AdminRevenueAnalytics,
  TimeSeriesPoint,
} from "@examora/types";
import type { EnrollmentSource } from "@examora/database";
import { PrismaService } from "../../prisma/prisma.service";

const ENROLLMENT_SOURCES: EnrollmentSource[] = ["FREE", "PURCHASE", "ADMIN_GRANT"];

/** Commerce/growth analytics: enrollments and revenue (analytics:admin, ADR-0020 §7). */
@Injectable()
export class AdminCommerceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEnrollmentAnalytics(days = 30): Promise<AdminEnrollmentAnalytics> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const [total, active, expired, revoked, bySource, recent] = await Promise.all([
      this.prisma.enrollment.count(),
      this.prisma.enrollment.count({ where: { status: "ACTIVE" } }),
      this.prisma.enrollment.count({ where: { status: "EXPIRED" } }),
      this.prisma.enrollment.count({ where: { status: "REVOKED" } }),
      Promise.all(
        ENROLLMENT_SOURCES.map(async (source) => ({
          source,
          count: await this.prisma.enrollment.count({ where: { source } }),
        })),
      ),
      this.prisma.enrollment.findMany({
        where: { enrolledAt: { gte: since } },
        select: { enrolledAt: true },
      }),
    ]);

    const byDay = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const day = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      byDay.set(day.toISOString().slice(0, 10), 0);
    }
    for (const e of recent) {
      const key = e.enrolledAt.toISOString().slice(0, 10);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const enrollmentsByDay: TimeSeriesPoint[] = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return {
      totalEnrollments: total,
      activeEnrollments: active,
      expiredEnrollments: expired,
      revokedEnrollments: revoked,
      enrollmentsBySource: bySource,
      enrollmentsByDay,
    };
  }

  async getRevenueAnalytics(days = 30): Promise<AdminRevenueAnalytics> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const [payments, paidOrders, refundAgg, couponRedemptions] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: "CAPTURED", verifiedAt: { gte: since } },
        select: { amount: true, verifiedAt: true },
      }),
      this.prisma.order.aggregate({
        where: { status: "PAID" },
        _count: true,
        _sum: { totalAmount: true },
      }),
      this.prisma.refund.aggregate({ where: { status: "PROCESSED" }, _sum: { amount: true } }),
      this.prisma.coupon.aggregate({ _sum: { redemptionCount: true } }),
    ]);

    const byDay = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const day = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      byDay.set(day.toISOString().slice(0, 10), 0);
    }
    for (const p of payments) {
      if (!p.verifiedAt) continue;
      const key = p.verifiedAt.toISOString().slice(0, 10);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + Number(p.amount));
    }

    const totalRevenue = Number(paidOrders._sum.totalAmount ?? 0);
    const ordersPaid = paidOrders._count;

    return {
      totalRevenue,
      currency: "INR",
      revenueByDay: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, amount]) => ({ date, amount })),
      ordersPaid,
      averageOrderValue: ordersPaid === 0 ? 0 : Math.round((totalRevenue / ordersPaid) * 100) / 100,
      totalRefunded: Number(refundAgg._sum.amount ?? 0),
      couponRedemptions: couponRedemptions._sum.redemptionCount ?? 0,
    };
  }
}
