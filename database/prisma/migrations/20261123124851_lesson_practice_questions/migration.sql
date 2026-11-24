-- CreateTable
CREATE TABLE "lesson_questions" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_question_answers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lesson_question_id" UUID NOT NULL,
    "selected_option_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "numeric_value" DECIMAL(14,4),
    "method" "answer_method",
    "correct" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_question_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_questions_lesson_id_idx" ON "lesson_questions"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_questions_lesson_id_question_id_key" ON "lesson_questions"("lesson_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_question_answers_user_id_lesson_question_id_key" ON "lesson_question_answers"("user_id", "lesson_question_id");

-- AddForeignKey
ALTER TABLE "lesson_questions" ADD CONSTRAINT "lesson_questions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_questions" ADD CONSTRAINT "lesson_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_question_answers" ADD CONSTRAINT "lesson_question_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_question_answers" ADD CONSTRAINT "lesson_question_answers_lesson_question_id_fkey" FOREIGN KEY ("lesson_question_id") REFERENCES "lesson_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
