-- CreateTable
CREATE TABLE "user_seen" (
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_seen_pkey" PRIMARY KEY ("user_id","key")
);

-- AddForeignKey
ALTER TABLE "user_seen" ADD CONSTRAINT "user_seen_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
