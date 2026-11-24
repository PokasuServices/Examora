-- CreateTable
CREATE TABLE "xp_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "xp_events_user_id_created_at_idx" ON "xp_events"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "xp_events_user_id_reason_source_type_source_id_key" ON "xp_events"("user_id", "reason", "source_type", "source_id");

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
