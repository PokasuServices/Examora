import {
  Bell,
  BookOpen,
  GraduationCap,
  MessageSquare,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { StatCard, StatCardSkeletonTile } from "@/components/dashboard/stat-card";
import { formatMoney } from "@/lib/commerce-api";
import type {
  AdminCommunityAnalytics,
  AdminNotificationDeliveryAnalytics,
  AdminPlatformDashboard,
  AdminRevenueAnalytics,
} from "@examora/types";

export function KpiGrid({
  status,
  platform,
  revenue,
  community,
  notifications,
  growthPercent,
}: {
  status: "loading" | "ready" | "error";
  platform: AdminPlatformDashboard | null;
  revenue: AdminRevenueAnalytics | null;
  community: AdminCommunityAnalytics | null;
  notifications: AdminNotificationDeliveryAnalytics | null;
  growthPercent: number | null;
}) {
  if (status === "loading" || !platform) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 9 }).map((_, i) => (
          <StatCardSkeletonTile key={i} />
        ))}
      </div>
    );
  }

  const communityActivity = community ? community.totalThreads + community.totalReplies : null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        icon={Users}
        tone="primary"
        label="Total users"
        value={platform.totalUsers.toLocaleString()}
        accessibleLabel="Total users"
      />
      <StatCard
        icon={GraduationCap}
        tone="success"
        label="Students"
        value={platform.totalStudents.toLocaleString()}
        accessibleLabel="Students"
      />
      <StatCard
        icon={Users}
        tone="accent"
        label="Mentors"
        value={platform.totalMentors.toLocaleString()}
        accessibleLabel="Mentors"
      />
      <StatCard
        icon={BookOpen}
        tone="primary"
        label="Courses"
        value={platform.totalCourses.toLocaleString()}
        accessibleLabel="Courses"
      />
      <StatCard
        icon={Wallet}
        tone="success"
        label="Revenue"
        value={formatMoney(platform.totalRevenue, platform.revenueCurrency)}
        accessibleLabel="Total revenue"
      />
      <StatCard
        icon={ShoppingBag}
        tone="warning"
        label="Paid orders"
        value={revenue ? revenue.ordersPaid.toLocaleString() : "—"}
        accessibleLabel="Paid orders"
      />
      <StatCard
        icon={MessageSquare}
        tone="accent"
        label="Community activity"
        value={communityActivity !== null ? communityActivity.toLocaleString() : "—"}
        accessibleLabel="Community activity"
      />
      <StatCard
        icon={Bell}
        tone="primary"
        label="Notifications sent"
        value={notifications ? notifications.totalNotifications.toLocaleString() : "—"}
        accessibleLabel="Notifications sent"
      />
      <StatCard
        icon={TrendingUp}
        tone={growthPercent !== null && growthPercent < 0 ? "danger" : "success"}
        label="User growth (30d)"
        value={growthPercent !== null ? `${growthPercent > 0 ? "+" : ""}${growthPercent}%` : "—"}
        accessibleLabel="User growth over the last 30 days"
      />
    </div>
  );
}
