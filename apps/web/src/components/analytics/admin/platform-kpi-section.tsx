import { BookOpen, DollarSign, GraduationCap, Users } from "lucide-react";
import type { AdminPlatformDashboard } from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";

export function PlatformKpiSection({ platform }: { platform: AdminPlatformDashboard }) {
  return (
    <section aria-labelledby="admin-platform-heading">
      <h2
        id="admin-platform-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Platform KPIs
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard
          icon={Users}
          tone="primary"
          label="Total Users"
          value={platform.totalUsers.toLocaleString()}
          accessibleLabel="Total users"
        />
        <StatCard
          icon={Users}
          tone="accent"
          label="Students / Mentors"
          value={`${platform.totalStudents.toLocaleString()} / ${platform.totalMentors.toLocaleString()}`}
          accessibleLabel="Total students and mentors"
        />
        <StatCard
          icon={BookOpen}
          tone="success"
          label="Published Courses"
          value={`${platform.publishedCourseCount}/${platform.totalCourses}`}
          accessibleLabel="Published courses out of total courses"
        />
        <StatCard
          icon={GraduationCap}
          tone="warning"
          label="Active Enrollments"
          value={`${platform.activeEnrollments.toLocaleString()}/${platform.totalEnrollments.toLocaleString()}`}
          accessibleLabel="Active enrollments out of total enrollments"
        />
        <StatCard
          icon={DollarSign}
          tone="success"
          label="Total Revenue"
          value={`${platform.revenueCurrency} ${platform.totalRevenue.toLocaleString()}`}
          accessibleLabel="Total platform revenue"
        />
      </div>
    </section>
  );
}
