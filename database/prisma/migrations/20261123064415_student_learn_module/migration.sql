-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "next_exam_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "xp_reward" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "level" "difficulty_level",
ADD COLUMN     "max_attempts" INTEGER,
ADD COLUMN     "topic_id" UUID,
ADD COLUMN     "xp_reward" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'SUBJECT';

-- CreateTable
CREATE TABLE "topic_ratings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "past_paper_stats" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "exam_label" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "question_count" INTEGER NOT NULL,

    CONSTRAINT "past_paper_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "topic_ratings_topic_id_idx" ON "topic_ratings"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "topic_ratings_user_id_topic_id_key" ON "topic_ratings"("user_id", "topic_id");

-- CreateIndex
CREATE INDEX "past_paper_stats_course_id_idx" ON "past_paper_stats"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "past_paper_stats_course_id_exam_label_subject_id_year_key" ON "past_paper_stats"("course_id", "exam_label", "subject_id", "year");

-- CreateIndex
CREATE INDEX "quizzes_topic_id_idx" ON "quizzes"("topic_id");

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_ratings" ADD CONSTRAINT "topic_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_ratings" ADD CONSTRAINT "topic_ratings_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "past_paper_stats" ADD CONSTRAINT "past_paper_stats_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "past_paper_stats" ADD CONSTRAINT "past_paper_stats_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
