-- CreateTable
CREATE TABLE "sketch_comments" (
    "id" UUID NOT NULL,
    "answer_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sketch_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sketch_comments_answer_id_idx" ON "sketch_comments"("answer_id");

-- AddForeignKey
ALTER TABLE "sketch_comments" ADD CONSTRAINT "sketch_comments_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "quiz_attempt_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_comments" ADD CONSTRAINT "sketch_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
