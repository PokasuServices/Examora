-- AlterEnum
ALTER TYPE "question_type" ADD VALUE 'NUMERIC';

-- AlterTable
ALTER TABLE "question_options" ADD COLUMN     "image_url" TEXT;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "explanation_image_url" TEXT,
ADD COLUMN     "explanation_video_url" TEXT,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "numeric_max" DECIMAL(14,4),
ADD COLUMN     "numeric_min" DECIMAL(14,4),
ADD COLUMN     "partial_marking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resources" JSONB;

-- AlterTable
ALTER TABLE "quiz_attempt_answers" ADD COLUMN     "numeric_answer" DECIMAL(14,4);

-- AlterTable
ALTER TABLE "quiz_questions" ADD COLUMN     "negative_marks" DECIMAL(6,2);
