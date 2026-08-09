import { GraduationCap, ShieldCheck, UserCog, Users, UserSearch } from "lucide-react";
import { StatCard, StatCardSkeletonTile } from "@/components/dashboard/stat-card";
import type { AdminUserGrowthAnalytics } from "@examora/types";

function roleCount(userGrowth: AdminUserGrowthAnalytics, role: string): number {
  return userGrowth.usersByRole.find((r) => r.role === role)?.count ?? 0;
}

export function DirectoryStats({
  status,
  userGrowth,
}: {
  status: "loading" | "ready" | "error";
  userGrowth: AdminUserGrowthAnalytics | null;
}) {
  if (status === "loading" || !userGrowth) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatCardSkeletonTile key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        icon={Users}
        tone="primary"
        label="Total users"
        value={userGrowth.totalUsers.toLocaleString()}
        accessibleLabel="Total users"
      />
      <StatCard
        icon={GraduationCap}
        tone="success"
        label="Students"
        value={roleCount(userGrowth, "STUDENT").toLocaleString()}
        accessibleLabel="Students"
      />
      <StatCard
        icon={UserCog}
        tone="accent"
        label="Mentors"
        value={roleCount(userGrowth, "MENTOR").toLocaleString()}
        accessibleLabel="Mentors"
      />
      <StatCard
        icon={UserSearch}
        tone="warning"
        label="Reviewers"
        value={roleCount(userGrowth, "REVIEWER").toLocaleString()}
        accessibleLabel="Reviewers"
      />
      <StatCard
        icon={ShieldCheck}
        tone="danger"
        label="Administrators"
        value={roleCount(userGrowth, "ADMINISTRATOR").toLocaleString()}
        accessibleLabel="Administrators"
      />
    </div>
  );
}
