import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories/categories.controller";
import { CategoriesService } from "./categories/categories.service";
import { CoursesController } from "./courses/courses.controller";
import { CoursesService } from "./courses/courses.service";
import { SubjectsController } from "./subjects/subjects.controller";
import { SubjectsService } from "./subjects/subjects.service";
import { TopicsController } from "./topics/topics.controller";
import { TopicsService } from "./topics/topics.service";
import { ModulesController } from "./modules/modules.controller";
import { ModulesService } from "./modules/modules.service";
import { LessonsController } from "./lessons/lessons.controller";
import { LessonsService } from "./lessons/lessons.service";

/**
 * Sprint 2 content hierarchy (ADR-0012): Category > Course > Subject > Topic >
 * Module > Lesson. All routes are admin-only (content:manage / content:publish);
 * student-facing read APIs are a later sprint.
 */
@Module({
  controllers: [
    CategoriesController,
    CoursesController,
    SubjectsController,
    TopicsController,
    ModulesController,
    LessonsController,
  ],
  providers: [
    CategoriesService,
    CoursesService,
    SubjectsService,
    TopicsService,
    ModulesService,
    LessonsService,
  ],
})
export class ContentModule {}
