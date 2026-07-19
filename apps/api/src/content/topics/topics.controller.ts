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
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { PaginatedData, Topic } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { ChangeStatusDto } from "../courses/dto/change-status.dto";
import { ReorderDto } from "../dto/reorder.dto";
import { toTopic } from "../content.mappers";
import { CreateTopicDto } from "./dto/create-topic.dto";
import { ListTopicsQueryDto } from "./dto/list-topics-query.dto";
import { TopicsService } from "./topics.service";
import { UpdateTopicDto } from "./dto/update-topic.dto";

@ApiTags("content: topics")
@Controller("admin/content/topics")
@RequirePermissions("content:manage")
export class TopicsController {
  constructor(
    private readonly topicsService: TopicsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a topic under a subject" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateTopicDto,
    @Req() req: Request,
  ): Promise<Topic> {
    const topic = await this.topicsService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.topic_created",
      entityType: "Topic",
      entityId: topic.id,
      after: { subjectId: topic.subjectId, title: topic.title, slug: topic.slug },
      ...requestAuditMeta(req),
    });
    return toTopic(topic);
  }

  @Get()
  @ApiOperation({ summary: "List topics in a subject" })
  async list(@Query() query: ListTopicsQueryDto): Promise<PaginatedData<Topic>> {
    const { items, total } = await this.topicsService.list({
      subjectId: query.subjectId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
    return { items: items.map(toTopic), page: query.page, pageSize: query.pageSize, total };
  }

  @Post("reorder")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reorder topics by an ordered id list" })
  async reorder(
    @CurrentUser() actor: RequestUser,
    @Body() dto: ReorderDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.topicsService.reorder(dto.orderedIds);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.topics_reordered",
      entityType: "Topic",
      after: { orderedIds: dto.orderedIds },
      ...requestAuditMeta(req),
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a topic by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<Topic> {
    return toTopic(await this.topicsService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a topic" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTopicDto,
    @Req() req: Request,
  ): Promise<Topic> {
    const before = await this.topicsService.findByIdOrThrow(id);
    const updated = await this.topicsService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.topic_updated",
      entityType: "Topic",
      entityId: id,
      before: { title: before.title, slug: before.slug },
      after: { title: updated.title, slug: updated.slug },
      ...requestAuditMeta(req),
    });
    return toTopic(updated);
  }

  @Patch(":id/status")
  @RequirePermissions("content:publish")
  @ApiOperation({ summary: "Change topic status — content:publish" })
  async changeStatus(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: Request,
  ): Promise<Topic> {
    const before = await this.topicsService.findByIdOrThrow(id);
    const updated = await this.topicsService.changeStatus(id, dto.status);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.topic_status_changed",
      entityType: "Topic",
      entityId: id,
      before: { status: before.status },
      after: { status: updated.status },
      ...requestAuditMeta(req),
    });
    return toTopic(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a topic" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.topicsService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.topic_deleted",
      entityType: "Topic",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
