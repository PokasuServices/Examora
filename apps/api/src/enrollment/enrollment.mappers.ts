import type { Enrollment as EnrollmentDto } from "@examora/types";

type EnrollmentRow = {
  id: string;
  userId: string;
  courseId: string;
  orderId: string | null;
  status: string;
  source: string;
  enrolledAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  user: { email: string };
  course: { title: string };
};

export function toEnrollment(row: EnrollmentRow): EnrollmentDto {
  return {
    id: row.id,
    userId: row.userId,
    userEmail: row.user.email,
    courseId: row.courseId,
    courseTitle: row.course.title,
    status: row.status as EnrollmentDto["status"],
    source: row.source as EnrollmentDto["source"],
    orderId: row.orderId,
    enrolledAt: row.enrolledAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}
