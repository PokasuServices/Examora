import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { QuizSection } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { ReorderDto } from "../../content/dto/reorder.dto";
import { toQuizSection } from "../assessment.mappers";
import { CreateQuizSectionDto } from "./dto/create-section.dto";
import { UpdateQuizSectionDto } from "./dto/update-section.dto";
import { QuizSectionsService } from "./sections.service";

@ApiTags("assessment: quiz sections")
@Controller("admin/assessment/quizzes/:quizId/sections")
@RequirePermissions("quiz:manage")
export class QuizSectionsController {
  constructor(
    private readonly sectionsService: QuizSectionsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Add a section to a quiz" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Param("quizId", ParseUUIDPipe) quizId: string,
    @Body() dto: CreateQuizSectionDto,
    @Req() req: Request,
  ): Promise<QuizSection> {
    const section = await this.sectionsService.create(quizId, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.quiz_section_created",
      entityType: "QuizSection",
      entityId: section.id,
      after: { quizId, title: section.title },
      ...requestAuditMeta(req),
    });
    return toQuizSection(section);
  }

  @Get()
  @ApiOperation({ summary: "List a quiz's sections" })
  async list(@Param("quizId", ParseUUIDPipe) quizId: string): Promise<QuizSection[]> {
    return (await this.sectionsService.list(quizId)).map(toQuizSection);
  }

  @Post("reorder")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reorder a quiz's sections" })
  async reorder(
    @CurrentUser() actor: RequestUser,
    @Param("quizId", ParseUUIDPipe) quizId: string,
    @Body() dto: ReorderDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.sectionsService.reorder(quizId, dto.orderedIds);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.quiz_sections_reordered",
      entityType: "QuizSection",
      after: { quizId, orderedIds: dto.orderedIds },
      ...requestAuditMeta(req),
    });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a section" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("quizId", ParseUUIDPipe) quizId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuizSectionDto,
    @Req() req: Request,
  ): Promise<QuizSection> {
    const updated = await this.sectionsService.update(quizId, id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.quiz_section_updated",
      entityType: "QuizSection",
      entityId: id,
      after: { title: updated.title },
      ...requestAuditMeta(req),
    });
    return toQuizSection(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a section (unassigns, does not delete, its questions)" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("quizId", ParseUUIDPipe) quizId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.sectionsService.remove(quizId, id);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.quiz_section_deleted",
      entityType: "QuizSection",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
