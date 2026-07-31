-- CreateEnum
CREATE TYPE "recommendation_type" AS ENUM ('COURSE', 'SIMILAR_COURSES', 'LEARNING_PATH', 'CONTINUE_LEARNING', 'QUIZ', 'ASSIGNMENT', 'COMMUNITY_DISCUSSION');

-- CreateTable
CREATE TABLE "recommendation_feature_flags" (
    "id" UUID NOT NULL,
    "type" "recommendation_type" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_feature_flags_type_key" ON "recommendation_feature_flags"("type");

-- AddForeignKey
ALTER TABLE "recommendation_feature_flags" ADD CONSTRAINT "recommendation_feature_flags_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
