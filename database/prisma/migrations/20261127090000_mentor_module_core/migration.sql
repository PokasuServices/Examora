-- DropIndex
DROP INDEX "daily_quizzes_date_key";

-- AlterTable
ALTER TABLE "cohort_mentors" ADD COLUMN     "ends_on" DATE,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'PRIMARY';

-- AlterTable
ALTER TABLE "daily_quizzes" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "question_doubts" ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_id" UUID;

-- CreateTable
CREATE TABLE "daily_quiz_schedules" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "question_ids" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_quiz_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_requests" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID,
    "target_label" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by_id" UUID NOT NULL,
    "decided_by_id" UUID,
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "staff_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'OFFLINE',
    "topic" TEXT,
    "taken_by_id" UUID,
    "taken_at" TIMESTAMP(3),
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("session_id","user_id")
);

-- CreateTable
CREATE TABLE "quiz_cohorts" (
    "quiz_id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_cohorts_pkey" PRIMARY KEY ("quiz_id","cohort_id")
);

-- CreateTable
CREATE TABLE "progress_reports" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "cohort_id" UUID,
    "mentor_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MONTHLY',
    "period" TEXT NOT NULL,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "remarks" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "admin_note" TEXT,
    "decided_by_id" UUID,
    "submitted_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_shoutouts" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "mentor_id" UUID NOT NULL,
    "badge" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_shoutouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_announcements" (
    "id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_quiz_schedules_course_id_date_key" ON "daily_quiz_schedules"("course_id", "date");

-- CreateIndex
CREATE INDEX "staff_requests_status_kind_created_at_idx" ON "staff_requests"("status", "kind", "created_at");

-- CreateIndex
CREATE INDEX "staff_requests_target_type_target_id_idx" ON "staff_requests"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "class_sessions_date_idx" ON "class_sessions"("date");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_cohort_id_date_start_key" ON "class_sessions"("cohort_id", "date", "start");

-- CreateIndex
CREATE INDEX "attendance_records_user_id_idx" ON "attendance_records"("user_id");

-- CreateIndex
CREATE INDEX "quiz_cohorts_cohort_id_idx" ON "quiz_cohorts"("cohort_id");

-- CreateIndex
CREATE INDEX "progress_reports_status_submitted_at_idx" ON "progress_reports"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "progress_reports_student_id_idx" ON "progress_reports"("student_id");

-- CreateIndex
CREATE INDEX "progress_reports_mentor_id_idx" ON "progress_reports"("mentor_id");

-- CreateIndex
CREATE INDEX "mentor_shoutouts_student_id_created_at_idx" ON "mentor_shoutouts"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "mentor_shoutouts_mentor_id_created_at_idx" ON "mentor_shoutouts"("mentor_id", "created_at");

-- CreateIndex
CREATE INDEX "batch_announcements_cohort_id_created_at_idx" ON "batch_announcements"("cohort_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "daily_quizzes_date_scope_key" ON "daily_quizzes"("date", "scope");

-- AddForeignKey
ALTER TABLE "daily_quiz_schedules" ADD CONSTRAINT "daily_quiz_schedules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quiz_schedules" ADD CONSTRAINT "daily_quiz_schedules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_requests" ADD CONSTRAINT "staff_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_requests" ADD CONSTRAINT "staff_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_taken_by_id_fkey" FOREIGN KEY ("taken_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_cohorts" ADD CONSTRAINT "quiz_cohorts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_cohorts" ADD CONSTRAINT "quiz_cohorts_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reports" ADD CONSTRAINT "progress_reports_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reports" ADD CONSTRAINT "progress_reports_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reports" ADD CONSTRAINT "progress_reports_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_shoutouts" ADD CONSTRAINT "mentor_shoutouts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_shoutouts" ADD CONSTRAINT "mentor_shoutouts_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_announcements" ADD CONSTRAINT "batch_announcements_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_announcements" ADD CONSTRAINT "batch_announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

