-- AlterTable
ALTER TABLE "forum_boards" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "forum_categories" ADD COLUMN     "deleted_at" TIMESTAMP(3);
