-- CreateEnum
CREATE TYPE "sketch_rating_kind" AS ENUM ('SELF', 'EXPERT');

-- CreateTable
CREATE TABLE "sketch_version_ratings" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "kind" "sketch_rating_kind" NOT NULL,
    "scores" JSONB NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sketch_version_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sketch_peer_feedback" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "liked_factors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comment" TEXT,
    "xp_awarded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sketch_peer_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sketch_version_ratings_version_id_idx" ON "sketch_version_ratings"("version_id");

-- CreateIndex
CREATE UNIQUE INDEX "sketch_version_ratings_version_id_rater_id_key" ON "sketch_version_ratings"("version_id", "rater_id");

-- CreateIndex
CREATE INDEX "sketch_peer_feedback_rater_id_created_at_idx" ON "sketch_peer_feedback"("rater_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sketch_peer_feedback_version_id_rater_id_key" ON "sketch_peer_feedback"("version_id", "rater_id");

-- AddForeignKey
ALTER TABLE "sketch_version_ratings" ADD CONSTRAINT "sketch_version_ratings_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "sketch_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_version_ratings" ADD CONSTRAINT "sketch_version_ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_peer_feedback" ADD CONSTRAINT "sketch_peer_feedback_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "sketch_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sketch_peer_feedback" ADD CONSTRAINT "sketch_peer_feedback_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
