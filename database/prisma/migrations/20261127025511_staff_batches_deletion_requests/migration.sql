-- AlterTable
ALTER TABLE "cohorts" ADD COLUMN     "course_id" UUID,
ADD COLUMN     "ends_on" DATE,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "meeting_url" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'OFFLINE',
ADD COLUMN     "schedule" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "starts_on" DATE;

-- CreateTable
CREATE TABLE "cohort_mentors" (
    "cohort_id" UUID NOT NULL,
    "mentor_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohort_mentors_pkey" PRIMARY KEY ("cohort_id","mentor_id")
);

-- CreateTable
CREATE TABLE "deletion_requests" (
    "id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "target_label" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "impact" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by_id" UUID NOT NULL,
    "decided_by_id" UUID,
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cohort_mentors_mentor_id_idx" ON "cohort_mentors"("mentor_id");

-- CreateIndex
CREATE INDEX "deletion_requests_status_created_at_idx" ON "deletion_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "deletion_requests_target_type_target_id_idx" ON "deletion_requests"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "cohorts_course_id_idx" ON "cohorts"("course_id");

-- AddForeignKey
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_mentors" ADD CONSTRAINT "cohort_mentors_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_mentors" ADD CONSTRAINT "cohort_mentors_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
