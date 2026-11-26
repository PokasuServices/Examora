-- CreateEnum
CREATE TYPE "doubt_kind" AS ENUM ('DOUBT', 'EXPLANATION');

-- AlterTable
ALTER TABLE "question_doubts" ADD COLUMN     "kind" "doubt_kind" NOT NULL DEFAULT 'DOUBT';
