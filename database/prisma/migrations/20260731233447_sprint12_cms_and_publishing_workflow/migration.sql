-- CreateEnum
CREATE TYPE "cms_content_type" AS ENUM ('PAGE', 'FAQ', 'ANNOUNCEMENT', 'BANNER');

-- CreateEnum
CREATE TYPE "cms_page_type" AS ENUM ('LANDING', 'STATIC');

-- CreateEnum
CREATE TYPE "cms_workflow_status" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "cms_assets" (
    "id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "scan_status" "file_scan_status" NOT NULL DEFAULT 'PENDING',
    "alt_text" TEXT,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_asset_usages" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "content_type" "cms_content_type" NOT NULL,
    "content_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_asset_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" UUID NOT NULL,
    "page_type" "cms_page_type" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "status" "cms_workflow_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "scheduled_publish_at" TIMESTAMP(3),
    "scheduled_unpublish_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_faq_items" (
    "id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "cms_workflow_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "scheduled_publish_at" TIMESTAMP(3),
    "scheduled_unpublish_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "cms_workflow_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "scheduled_publish_at" TIMESTAMP(3),
    "scheduled_unpublish_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_banners" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "image_asset_id" UUID,
    "link_url" TEXT,
    "placement" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "cms_workflow_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "scheduled_publish_at" TIMESTAMP(3),
    "scheduled_unpublish_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_content_versions" (
    "id" UUID NOT NULL,
    "content_type" "cms_content_type" NOT NULL,
    "content_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "status" "cms_workflow_status" NOT NULL,
    "change_note" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_assets_storage_key_key" ON "cms_assets"("storage_key");

-- CreateIndex
CREATE INDEX "cms_asset_usages_content_type_content_id_idx" ON "cms_asset_usages"("content_type", "content_id");

-- CreateIndex
CREATE UNIQUE INDEX "cms_asset_usages_asset_id_content_type_content_id_key" ON "cms_asset_usages"("asset_id", "content_type", "content_id");

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_slug_key" ON "cms_pages"("slug");

-- CreateIndex
CREATE INDEX "cms_pages_page_type_status_idx" ON "cms_pages"("page_type", "status");

-- CreateIndex
CREATE INDEX "cms_faq_items_status_position_idx" ON "cms_faq_items"("status", "position");

-- CreateIndex
CREATE INDEX "cms_announcements_status_idx" ON "cms_announcements"("status");

-- CreateIndex
CREATE INDEX "cms_banners_placement_status_position_idx" ON "cms_banners"("placement", "status", "position");

-- CreateIndex
CREATE INDEX "cms_content_versions_content_type_content_id_idx" ON "cms_content_versions"("content_type", "content_id");

-- CreateIndex
CREATE UNIQUE INDEX "cms_content_versions_content_type_content_id_version_number_key" ON "cms_content_versions"("content_type", "content_id", "version_number");

-- AddForeignKey
ALTER TABLE "cms_assets" ADD CONSTRAINT "cms_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_asset_usages" ADD CONSTRAINT "cms_asset_usages_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "cms_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_faq_items" ADD CONSTRAINT "cms_faq_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_faq_items" ADD CONSTRAINT "cms_faq_items_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_announcements" ADD CONSTRAINT "cms_announcements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_announcements" ADD CONSTRAINT "cms_announcements_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banners" ADD CONSTRAINT "cms_banners_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "cms_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banners" ADD CONSTRAINT "cms_banners_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banners" ADD CONSTRAINT "cms_banners_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_content_versions" ADD CONSTRAINT "cms_content_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
