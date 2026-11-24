-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN     "current_section" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "section_plan" JSONB,
ADD COLUMN     "section_started_at" TIMESTAMP(3);
