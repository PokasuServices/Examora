import { Injectable } from "@nestjs/common";
import type {
  AdminPlatformDashboard,
  AdminUserGrowthAnalytics,
  TimeSeriesPoint,
} from "@examora/types";
import type { RoleName } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";

const ROLE_NAMES: RoleName[] = ["STUDENT", "MENTOR", "REVIEWER", "ADMINISTRATOR", "GUARDIAN"];

/** Cross-platform KPIs and growth trend (analytics:admin, ADR-0020 §7). */
@Injectable()
export class AdminPlatformAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(): Promise<AdminPlatformDashboard> {
    const [
      totalUsers,
      totalStudents,
      totalMentors,
      totalCourses,
      publishedCourseCount,
      totalEnrollments,
      activeEnrollments,
      revenueAgg,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { roles: { some: { role: { name: "STUDENT" } } } } }),
      this.prisma.user.count({ where: { roles: { some: { role: { name: "MENTOR" } } } } }),
      this.prisma.course.count({ where: { deletedAt: null } }),
      this.prisma.course.count({ where: { status: "PUBLISHED", deletedAt: null } }),
      this.prisma.enrollment.count(),
      this.prisma.enrollment.count({ where: { status: "ACTIVE" } }),
      this.prisma.payment.aggregate({ where: { status: "CAPTURED" }, _sum: { amount: true } }),
    ]);

    return {
      totalUsers,
      totalStudents,
      totalMentors,
      totalCourses,
      publishedCourseCount,
      totalEnrollments,
      activeEnrollments,
      totalRevenue: Number(revenueAgg._sum.amount ?? 0),
      revenueCurrency: "INR",
    };
  }

  async getUserGrowth(days = 30): Promise<AdminUserGrowthAnalytics> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const [newUsers, totalUsers, roleCounts] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.user.count(),
      Promise.all(
        ROLE_NAMES.map(async (name) => ({
          role: name,
          count: await this.prisma.user.count({ where: { roles: { some: { role: { name } } } } }),
        })),
      ),
    ]);

    const byDay = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const day = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      byDay.set(day.toISOString().slice(0, 10), 0);
    }
    for (const user of newUsers) {
      const key = user.createdAt.toISOString().slice(0, 10);
      if (byDay.has(key)) {
        byDay.set(key, (byDay.get(key) ?? 0) + 1);
      }
    }

    const newUsersByDay: TimeSeriesPoint[] = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return { newUsersByDay, totalUsers, usersByRole: roleCounts };
  }
}
