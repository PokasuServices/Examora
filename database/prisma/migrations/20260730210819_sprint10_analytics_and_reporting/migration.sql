-- CreateEnum
CREATE TYPE "report_type" AS ENUM ('STUDENT_PROGRESS', 'COURSE_COMPLETION', 'QUIZ_PERFORMANCE', 'ASSIGNMENT_PERFORMANCE', 'ENROLLMENT', 'REVENUE', 'COURSE_PERFORMANCE', 'MENTOR_PERFORMANCE', 'COMMUNITY_ACTIVITY', 'NOTIFICATION_DELIVERY');

-- CreateEnum
CREATE TYPE "report_cadence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "report_format" AS ENUM ('CSV', 'PDF');

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "report_type" "report_type" NOT NULL,
    "format" "report_format" NOT NULL DEFAULT 'CSV',
    "cadence" "report_cadence" NOT NULL,
    "filters" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_reports_created_by_id_idx" ON "scheduled_reports"("created_by_id");

-- CreateIndex
CREATE INDEX "scheduled_reports_is_active_next_run_at_idx" ON "scheduled_reports"("is_active", "next_run_at");

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
