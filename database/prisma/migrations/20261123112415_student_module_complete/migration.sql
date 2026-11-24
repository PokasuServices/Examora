-- CreateEnum
CREATE TYPE "answer_method" AS ENUM ('KNOWLEDGE', 'ELIMINATION', 'GUESS');

-- AlterEnum
ALTER TYPE "question_type" ADD VALUE 'UPLOAD';

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "criteria" JSONB,
ADD COLUMN     "topic_id" UUID;

-- AlterTable
ALTER TABLE "quiz_attempt_answers" ADD COLUMN     "flagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "method" "answer_method",
ADD COLUMN     "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "upload_asset_id" UUID,
ADD COLUMN     "visited_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "practice_category_id" UUID,
ADD COLUMN     "require_all_visited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unlock_after_quiz_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "exam_year" INTEGER,
ADD COLUMN     "guardian_phone" TEXT;

-- CreateTable
CREATE TABLE "practice_categories" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_reports" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "attempt_id" UUID,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_doubts" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "question_doubts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubt_claps" (
    "doubt_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doubt_claps_pkey" PRIMARY KEY ("doubt_id","user_id")
);

-- CreateTable
CREATE TABLE "sketch_reviews" (
    "id" UUID NOT NULL,
    "answer_id" UUID NOT NULL,
    "self_scores" JSONB,
    "self_rated_at" TIMESTAMP(3),
    "expert_scores" JSONB,
    "expert_comment" TEXT,
    "expert_id" UUID,
    "expert_reviewed_at" TIMESTAMP(3),

    CONSTRAINT "sketch_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sketch_peer_ratings" (
    "id" UUID NOT NULL,
    "answer_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sketch_peer_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_quizzes" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "question_ids" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_quiz_attempts" (
    "id" UUID NOT NULL,
    "daily_quiz_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "answers" JSONB,
    "correct_count" INTEGER,
    "total_ms" INTEGER,

    CONSTRAINT "daily_quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colleges" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logo_url" TEXT,
    "application_fee" INTEGER,
    "website" TEXT,
    "description" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colleges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "college_shortlists" (
    "user_id" UUID NOT NULL,
    "college_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "college_shortlists_pkey" PRIMARY KEY ("user_id","college_id")
);

-- CreateTable
CREATE TABLE "college_enquiries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "college_id" UUID NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "college_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webinars" (
    "id" UUID NOT NULL,
    "college_id" UUID,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "banner_url" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "join_url" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webinars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webinar_registrations" (
    "webinar_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webinar_registrations_pkey" PRIMARY KEY ("webinar_id","user_id")
);

-- CreateTable
CREATE TABLE "student_goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "target_percent" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_checkpoints" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "due_date" DATE,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoint_completions" (
    "checkpoint_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkpoint_completions_pkey" PRIMARY KEY ("checkpoint_id","user_id")
);

-- CreateTable
CREATE TABLE "topic_study_marks" (
    "user_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_study_marks_pkey" PRIMARY KEY ("user_id","topic_id")
);

-- CreateTable
CREATE TABLE "cohorts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "batch" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_members" (
    "cohort_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohort_members_pkey" PRIMARY KEY ("cohort_id","user_id")
);

-- CreateIndex
CREATE INDEX "practice_categories_course_id_idx" ON "practice_categories"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "practice_categories_course_id_slug_key" ON "practice_categories"("course_id", "slug");

-- CreateIndex
CREATE INDEX "question_reports_status_created_at_idx" ON "question_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "question_doubts_question_id_created_at_idx" ON "question_doubts"("question_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sketch_reviews_answer_id_key" ON "sketch_reviews"("answer_id");

-- CreateIndex
CREATE UNIQUE INDEX "sketch_peer_ratings_answer_id_rater_id_key" ON "sketch_peer_ratings"("answer_id", "rater_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_quizzes_date_key" ON "daily_quizzes"("date");

-- CreateIndex
CREATE INDEX "daily_quiz_attempts_daily_quiz_id_correct_count_total_ms_idx" ON "daily_quiz_attempts"("daily_quiz_id", "correct_count", "total_ms");

-- CreateIndex
CREATE UNIQUE INDEX "daily_quiz_attempts_daily_quiz_id_user_id_key" ON "daily_quiz_attempts"("daily_quiz_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "colleges_slug_key" ON "colleges"("slug");

-- CreateIndex
CREATE INDEX "colleges_published_position_idx" ON "colleges"("published", "position");

-- CreateIndex
CREATE INDEX "college_enquiries_status_created_at_idx" ON "college_enquiries"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "webinars_slug_key" ON "webinars"("slug");

-- CreateIndex
CREATE INDEX "webinars_published_starts_at_idx" ON "webinars"("published", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "student_goals_user_id_course_id_key" ON "student_goals"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "course_checkpoints_course_id_idx" ON "course_checkpoints"("course_id");

-- CreateIndex
CREATE INDEX "questions_topic_id_idx" ON "questions"("topic_id");

-- CreateIndex
CREATE INDEX "quizzes_practice_category_id_idx" ON "quizzes"("practice_category_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_practice_category_id_fkey" FOREIGN KEY ("practice_category_id") REFERENCES "practice_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_unlock_after_quiz_id_fkey" FOREIGN KEY ("unlock_after_quiz_id") REFERENCES "quizzes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_categories" ADD CONSTRAINT "practice_categories_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_doubts" ADD CONSTRAINT "question_doubts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_doubts" ADD CONSTRAINT "question_doubts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_doubts" ADD CONSTRAINT "question_doubts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "question_doubts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_claps" ADD CONSTRAINT "doubt_claps_doubt_id_fkey" FOREIGN KEY ("doubt_id") REFERENCES "question_doubts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_claps" ADD CONSTRAINT "doubt_claps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_reviews" ADD CONSTRAINT "sketch_reviews_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "quiz_attempt_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_reviews" ADD CONSTRAINT "sketch_reviews_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_peer_ratings" ADD CONSTRAINT "sketch_peer_ratings_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "quiz_attempt_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_peer_ratings" ADD CONSTRAINT "sketch_peer_ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quiz_attempts" ADD CONSTRAINT "daily_quiz_attempts_daily_quiz_id_fkey" FOREIGN KEY ("daily_quiz_id") REFERENCES "daily_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quiz_attempts" ADD CONSTRAINT "daily_quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "college_shortlists" ADD CONSTRAINT "college_shortlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "college_shortlists" ADD CONSTRAINT "college_shortlists_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "college_enquiries" ADD CONSTRAINT "college_enquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "college_enquiries" ADD CONSTRAINT "college_enquiries_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinars" ADD CONSTRAINT "webinars_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "colleges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_webinar_id_fkey" FOREIGN KEY ("webinar_id") REFERENCES "webinars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_goals" ADD CONSTRAINT "student_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_checkpoints" ADD CONSTRAINT "course_checkpoints_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoint_completions" ADD CONSTRAINT "checkpoint_completions_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "course_checkpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoint_completions" ADD CONSTRAINT "checkpoint_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_study_marks" ADD CONSTRAINT "topic_study_marks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_study_marks" ADD CONSTRAINT "topic_study_marks_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_members" ADD CONSTRAINT "cohort_members_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_members" ADD CONSTRAINT "cohort_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
