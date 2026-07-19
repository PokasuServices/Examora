import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "./audit.service";

describe("AuditService (integration)", () => {
  let service: AuditService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  const entityId = `audit-test-${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [AuditService, PrismaService],
    }).compile();

    service = moduleRef.get(AuditService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId } });
    await moduleRef.close();
  });

  it("persists an append-only audit event with before/after state", async () => {
    await service.record({
      actorId: null,
      action: "test.event",
      entityType: "TestEntity",
      entityId,
      before: { status: "old" },
      after: { status: "new" },
      ipAddress: "127.0.0.1",
      correlationId: "corr-1",
    });

    const rows = await prisma.auditLog.findMany({ where: { entityId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("test.event");
    expect(rows[0]?.beforeState).toEqual({ status: "old" });
    expect(rows[0]?.afterState).toEqual({ status: "new" });
  });

  it("lists and filters audit events by entityType", async () => {
    await service.record({ action: "test.event.2", entityType: "TestEntity", entityId });

    const { items, total } = await service.list({
      page: 1,
      pageSize: 10,
      entityType: "TestEntity",
    });
    const matching = items.filter((item) => item.entityId === entityId);

    expect(matching.length).toBeGreaterThanOrEqual(2);
    expect(total).toBeGreaterThanOrEqual(2);
  });
});
