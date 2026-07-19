import { Injectable } from "@nestjs/common";
import type { Prisma } from "@examora/database";
import { PrismaService } from "../prisma/prisma.service";

export interface RecordAuditEventParams {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string | null;
  correlationId?: string | null;
}

/**
 * Append-only audit trail (MDG-00 §14 "never remove audit logging", SEC-13 §7).
 * Every sensitive Identity action calls this — see call sites in AuthService,
 * UsersService and AdminUsersService.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordAuditEventParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        beforeState: params.before as Prisma.InputJsonValue | undefined,
        afterState: params.after as Prisma.InputJsonValue | undefined,
        ipAddress: params.ipAddress ?? null,
        correlationId: params.correlationId ?? null,
      },
    });
  }

  /** Admin-only read path (SEC-13 §7, API-17 `GET /admin/audit-logs`). */
  async list(params: { page: number; pageSize: number; entityType?: string; actorId?: string }) {
    const where = {
      entityType: params.entityType,
      actorId: params.actorId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
