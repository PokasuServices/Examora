-- CreateEnum
CREATE TYPE "sketch_version_kind" AS ENUM ('TEST', 'REVISION');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "rubric_id" UUID;

-- AlterTable
ALTER TABLE "sketch_comments" ADD COLUMN     "version_id" UUID,
ALTER COLUMN "answer_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "sketch_rubrics" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "factors" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sketch_rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sketch_works" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sketch_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sketch_versions" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "kind" "sketch_version_kind" NOT NULL,
    "answer_id" UUID,
    "asset_id" UUID NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sketch_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sketch_work_views" (
    "work_id" UUID NOT NULL,
    "viewer_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sketch_work_views_pkey" PRIMARY KEY ("work_id","viewer_id")
);

-- CreateTable
CREATE TABLE "sketch_claps" (
    "work_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sketch_claps_pkey" PRIMARY KEY ("work_id","user_id")
);

-- CreateTable
CREATE TABLE "sketch_work_comments" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sketch_work_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sketch_reports" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sketch_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sketch_works_question_id_idx" ON "sketch_works"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "sketch_works_user_id_question_id_key" ON "sketch_works"("user_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "sketch_versions_answer_id_key" ON "sketch_versions"("answer_id");

-- CreateIndex
CREATE INDEX "sketch_versions_work_id_idx" ON "sketch_versions"("work_id");

-- CreateIndex
CREATE INDEX "sketch_work_comments_work_id_idx" ON "sketch_work_comments"("work_id");

-- CreateIndex
CREATE UNIQUE INDEX "sketch_reports_work_id_reporter_id_key" ON "sketch_reports"("work_id", "reporter_id");

-- CreateIndex
CREATE INDEX "sketch_comments_version_id_idx" ON "sketch_comments"("version_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "sketch_rubrics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_comments" ADD CONSTRAINT "sketch_comments_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "sketch_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_works" ADD CONSTRAINT "sketch_works_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_works" ADD CONSTRAINT "sketch_works_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_versions" ADD CONSTRAINT "sketch_versions_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "sketch_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_versions" ADD CONSTRAINT "sketch_versions_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "quiz_attempt_answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_work_views" ADD CONSTRAINT "sketch_work_views_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "sketch_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_work_views" ADD CONSTRAINT "sketch_work_views_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_claps" ADD CONSTRAINT "sketch_claps_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "sketch_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_claps" ADD CONSTRAINT "sketch_claps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_work_comments" ADD CONSTRAINT "sketch_work_comments_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "sketch_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_work_comments" ADD CONSTRAINT "sketch_work_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_reports" ADD CONSTRAINT "sketch_reports_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "sketch_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_reports" ADD CONSTRAINT "sketch_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
