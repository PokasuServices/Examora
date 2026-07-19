-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "lesson_content_type" AS ENUM ('TEXT', 'VIDEO', 'PDF', 'IMAGE', 'ARTICLE');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "category_id" UUID,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "exam_type" TEXT,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content_type" "lesson_content_type" NOT NULL DEFAULT 'TEXT',
    "body" TEXT,
    "content_url" TEXT,
    "duration_minutes" INTEGER,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_idx" ON "categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_category_id_idx" ON "courses"("category_id");

-- CreateIndex
CREATE INDEX "courses_status_idx" ON "courses"("status");

-- CreateIndex
CREATE INDEX "courses_exam_type_idx" ON "courses"("exam_type");

-- CreateIndex
CREATE INDEX "subjects_course_id_idx" ON "subjects"("course_id");

-- CreateIndex
CREATE INDEX "subjects_status_idx" ON "subjects"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_course_id_slug_key" ON "subjects"("course_id", "slug");

-- CreateIndex
CREATE INDEX "topics_subject_id_idx" ON "topics"("subject_id");

-- CreateIndex
CREATE INDEX "topics_status_idx" ON "topics"("status");

-- CreateIndex
CREATE UNIQUE INDEX "topics_subject_id_slug_key" ON "topics"("subject_id", "slug");

-- CreateIndex
CREATE INDEX "modules_topic_id_idx" ON "modules"("topic_id");

-- CreateIndex
CREATE INDEX "modules_status_idx" ON "modules"("status");

-- CreateIndex
CREATE UNIQUE INDEX "modules_topic_id_slug_key" ON "modules"("topic_id", "slug");

-- CreateIndex
CREATE INDEX "lessons_module_id_idx" ON "lessons"("module_id");

-- CreateIndex
CREATE INDEX "lessons_status_idx" ON "lessons"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_module_id_slug_key" ON "lessons"("module_id", "slug");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
