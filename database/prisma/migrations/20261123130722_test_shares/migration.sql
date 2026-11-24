-- CreateTable
CREATE TABLE "test_shares" (
    "id" UUID NOT NULL,
    "sharer_id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_share_visits" (
    "id" UUID NOT NULL,
    "share_id" UUID NOT NULL,
    "visitor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_share_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_shares_code_key" ON "test_shares"("code");

-- CreateIndex
CREATE UNIQUE INDEX "test_shares_sharer_id_quiz_id_key" ON "test_shares"("sharer_id", "quiz_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_share_visits_share_id_visitor_id_key" ON "test_share_visits"("share_id", "visitor_id");

-- AddForeignKey
ALTER TABLE "test_shares" ADD CONSTRAINT "test_shares_sharer_id_fkey" FOREIGN KEY ("sharer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_shares" ADD CONSTRAINT "test_shares_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_share_visits" ADD CONSTRAINT "test_share_visits_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "test_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_share_visits" ADD CONSTRAINT "test_share_visits_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
