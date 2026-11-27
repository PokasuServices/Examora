import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DELETION_TARGET_LABEL,
  type DeletionPreview,
  type DeletionRequestStatus,
  type DeletionRequestView,
  type DeletionTargetType,
} from "@examora/types";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { DeletionTargets } from "./deletion-targets";

const PERSON = { select: { id: true, firstName: true, lastName: true, email: true } } as const;
const nameOf = (u: { firstName: string | null; lastName: string | null; email: string }) =>
  `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;

/**
 * Mentors can't delete records; they ask an administrator, who approves
 * (the record is deleted by its own module's service) or rejects with a note.
 * Both sides get a bell notification and every step is audited (MF0).
 */
@Injectable()
export class DeletionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: DeletionTargets,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private async pendingFor(type: DeletionTargetType, id: string) {
    return this.prisma.deletionRequest.findFirst({
      where: { targetType: type, targetId: id, status: "PENDING" },
      select: { id: true },
    });
  }

  async preview(type: DeletionTargetType, id: string): Promise<DeletionPreview> {
    const { label, impact } = await this.targets.describe(type, id);
    return {
      targetType: type,
      targetId: id,
      label,
      impact,
      pendingRequestId: (await this.pendingFor(type, id))?.id ?? null,
    };
  }

  async create(
    userId: string,
    type: DeletionTargetType,
    id: string,
    reason: string,
  ): Promise<DeletionRequestView> {
    const { label, impact } = await this.targets.describe(type, id);
    if (await this.pendingFor(type, id)) {
      throw new ConflictException("A deletion request for this is already waiting for an admin");
    }
    const row = await this.prisma.deletionRequest.create({
      data: {
        targetType: type,
        targetId: id,
        targetLabel: label,
        reason: reason.trim(),
        impact,
        requestedById: userId,
      },
      include: { requestedBy: PERSON, decidedBy: PERSON },
    });
    await this.audit.record({
      actorId: userId,
      action: "deletion_request.created",
      entityType: type,
      entityId: id,
      after: { requestId: row.id, reason: row.reason },
    });
    // Tell every administrator there's something to review.
    const admins = await this.prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: { name: "ADMINISTRATOR" } } } },
      select: { id: true },
    });
    const requester = nameOf(row.requestedBy);
    for (const a of admins) {
      await this.notifications.enqueue({
        userId: a.id,
        eventType: "staff.deletion_requested",
        category: "platform",
        title: `Deletion request: ${DELETION_TARGET_LABEL[type]} "${label}"`,
        body: `${requester} asks to delete it: ${reason.trim()}`,
        data: { requestId: row.id, targetType: type, targetId: id },
      });
    }
    return this.toView(row);
  }

  async listMine(userId: string): Promise<DeletionRequestView[]> {
    const rows = await this.prisma.deletionRequest.findMany({
      where: { requestedById: userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { requestedBy: PERSON, decidedBy: PERSON },
    });
    return rows.map((r) => this.toView(r));
  }

  async list(status?: DeletionRequestStatus): Promise<DeletionRequestView[]> {
    const rows = await this.prisma.deletionRequest.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: { requestedBy: PERSON, decidedBy: PERSON },
    });
    // PENDING first ("APPROVED" < "PENDING" < "REJECTED" alphabetically, so sort explicitly).
    const rank = (s: string) => (s === "PENDING" ? 0 : 1);
    return rows.sort((a, b) => rank(a.status) - rank(b.status)).map((r) => this.toView(r));
  }

  private async loadPending(id: string) {
    const row = await this.prisma.deletionRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Request not found");
    if (row.status !== "PENDING")
      throw new ConflictException("This request has already been decided");
    return row;
  }

  async approve(reviewerId: string, id: string, note?: string): Promise<DeletionRequestView> {
    const req = await this.loadPending(id);
    const type = req.targetType as DeletionTargetType;
    const handler = this.targets.handler(type);
    let decisionNote = note?.trim() || null;
    if ((await handler.label(req.targetId)) === null) {
      decisionNote = decisionNote ?? "It had already been deleted.";
    } else {
      // The module's own delete: its checks (e.g. "still in use") still apply.
      await handler.remove(req.targetId);
    }
    const row = await this.prisma.deletionRequest.update({
      where: { id },
      data: { status: "APPROVED", decidedById: reviewerId, decidedAt: new Date(), decisionNote },
      include: { requestedBy: PERSON, decidedBy: PERSON },
    });
    await this.audit.record({
      actorId: reviewerId,
      action: "deletion_request.approved",
      entityType: type,
      entityId: req.targetId,
      before: { label: req.targetLabel },
      after: { requestId: id, requestedById: req.requestedById },
    });
    await this.notifyRequester(row, "approved");
    return this.toView(row);
  }

  async reject(reviewerId: string, id: string, note: string): Promise<DeletionRequestView> {
    if (!note.trim()) throw new BadRequestException("Say why, so the mentor knows");
    const req = await this.loadPending(id);
    const row = await this.prisma.deletionRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        decidedById: reviewerId,
        decidedAt: new Date(),
        decisionNote: note.trim(),
      },
      include: { requestedBy: PERSON, decidedBy: PERSON },
    });
    await this.audit.record({
      actorId: reviewerId,
      action: "deletion_request.rejected",
      entityType: req.targetType,
      entityId: req.targetId,
      after: { requestId: id, note: note.trim() },
    });
    await this.notifyRequester(row, "rejected");
    return this.toView(row);
  }

  private async notifyRequester(
    row: {
      requestedById: string;
      targetType: string;
      targetLabel: string;
      decisionNote: string | null;
      id: string;
    },
    outcome: "approved" | "rejected",
  ) {
    const what = `${DELETION_TARGET_LABEL[row.targetType as DeletionTargetType] ?? "Item"} "${row.targetLabel}"`;
    await this.notifications.enqueue({
      userId: row.requestedById,
      eventType: `staff.deletion_${outcome}`,
      category: "platform",
      title: outcome === "approved" ? `Deleted: ${what}` : `Deletion declined: ${what}`,
      body:
        outcome === "approved"
          ? `An administrator approved your request.${row.decisionNote ? ` ${row.decisionNote}` : ""}`
          : `An administrator kept it. Reason: ${row.decisionNote}`,
      data: { requestId: row.id },
    });
  }

  private toView(r: {
    id: string;
    targetType: string;
    targetId: string;
    targetLabel: string;
    reason: string;
    impact: unknown;
    status: string;
    decisionNote: string | null;
    createdAt: Date;
    decidedAt: Date | null;
    requestedBy: { id: string; firstName: string | null; lastName: string | null; email: string };
    decidedBy: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    } | null;
  }): DeletionRequestView {
    return {
      id: r.id,
      targetType: r.targetType as DeletionTargetType,
      targetId: r.targetId,
      targetLabel: r.targetLabel,
      reason: r.reason,
      impact: Array.isArray(r.impact) ? (r.impact as DeletionRequestView["impact"]) : [],
      status: r.status as DeletionRequestStatus,
      requestedBy: {
        id: r.requestedBy.id,
        name: nameOf(r.requestedBy),
        email: r.requestedBy.email,
      },
      decidedBy: r.decidedBy ? { id: r.decidedBy.id, name: nameOf(r.decidedBy) } : null,
      decisionNote: r.decisionNote,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
    };
  }
}
