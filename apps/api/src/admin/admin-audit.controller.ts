import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuditLogEntry, PaginatedData } from "@examora/types";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuditService } from "../audit/audit.service";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

@ApiTags("admin")
@Controller("admin/audit-logs")
@RequirePermissions("audit_logs:read")
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: "Search the append-only audit trail (admin only, SEC-13 §7)" })
  async list(@Query() query: ListAuditLogsQueryDto): Promise<PaginatedData<AuditLogEntry>> {
    const { items, total } = await this.auditService.list({
      page: query.page,
      pageSize: query.pageSize,
      entityType: query.entityType,
      actorId: query.actorId,
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        actorId: item.actorId,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        beforeState: item.beforeState,
        afterState: item.afterState,
        ipAddress: item.ipAddress,
        correlationId: item.correlationId,
        createdAt: item.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
}
