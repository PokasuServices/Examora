-- AlterTable
ALTER TABLE "quiz_sections" ADD COLUMN     "time_limit_minutes" INTEGER;

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "exam" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "paper_year" INTEGER,
ADD COLUMN     "perfect_bonus_xp" INTEGER NOT NULL DEFAULT 0;
