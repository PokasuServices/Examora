-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "exam_tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "topic_marks" (
    "user_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "favourite" BOOLEAN NOT NULL DEFAULT false,
    "on_hold" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_marks_pkey" PRIMARY KEY ("user_id","topic_id")
);

-- CreateIndex
CREATE INDEX "topic_marks_topic_id_idx" ON "topic_marks"("topic_id");

-- AddForeignKey
ALTER TABLE "topic_marks" ADD CONSTRAINT "topic_marks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_marks" ADD CONSTRAINT "topic_marks_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
