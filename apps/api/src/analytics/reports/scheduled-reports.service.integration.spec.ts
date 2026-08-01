import { NotFoundException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { SCHEDULED_REPORT_QUEUE } from "./scheduled-report.constants";
import { ScheduledReportsService } from "./scheduled-reports.service";

describe("ScheduledReportsService (integration)", () => {
  let service: ScheduledReportsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let userId: string;
  const suffix = Date.now();

  const upsertJobScheduler = jest.fn(async () => undefined);
  const removeJobScheduler = jest.fn(async () => undefined);
  const add = jest.fn(async () => undefined);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ScheduledReportsService,
        PrismaService,
        {
          provide: getQueueToken(SCHEDULED_REPORT_QUEUE),
          useValue: { upsertJobScheduler, removeJobScheduler, add },
        },
      ],
    }).compile();
    service = moduleRef.get(ScheduledReportsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { email: `scheduled-reports-${suffix}@example.test`, status: "ACTIVE" },
    });
    userId = user.id;
  });

  afterEach(() => {
    upsertJobScheduler.mockClear();
    removeJobScheduler.mockClear();
    add.mockClear();
  });

  afterAll(async () => {
    await prisma.scheduledReport.deleteMany({ where: { createdById: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await moduleRef.close();
  });

  it("creates a report and syncs its BullMQ job scheduler on the cadence interval", async () => {
    const report = await service.create(userId, {
      name: "Weekly enrollment digest",
      reportType: "ENROLLMENT",
      format: "CSV",
      cadence: "WEEKLY",
    });
    expect(report.isActive).toBe(true);
    expect(upsertJobScheduler).toHaveBeenCalledWith(
      report.id,
      { every: 7 * 24 * 60 * 60 * 1000 },
      expect.objectContaining({ name: "run-scheduled-report" }),
    );
  });

  it("removes the job scheduler when deactivated, and re-adds it when reactivated", async () => {
    const report = await service.create(userId, {
      name: "Daily revenue digest",
      reportType: "REVENUE",
      format: "PDF",
      cadence: "DAILY",
    });
    upsertJobScheduler.mockClear();

    await service.setActive(report.id, false);
    expect(removeJobScheduler).toHaveBeenCalledWith(report.id);

    await service.setActive(report.id, true);
    expect(upsertJobScheduler).toHaveBeenCalledWith(
      report.id,
      { every: 24 * 60 * 60 * 1000 },
      expect.anything(),
    );
  });

  it("lists only the caller's own scheduled reports when scoped", async () => {
    const other = await prisma.user.create({
      data: { email: `scheduled-reports-other-${suffix}@example.test`, status: "ACTIVE" },
    });
    try {
      await service.create(other.id, {
        name: "Other user's report",
        reportType: "REVENUE",
        format: "CSV",
        cadence: "MONTHLY",
      });
      const mine = await service.list(userId);
      expect(mine.every((r) => r.createdById === userId)).toBe(true);
    } finally {
      await prisma.scheduledReport.deleteMany({ where: { createdById: other.id } });
      await prisma.user.deleteMany({ where: { id: other.id } });
    }
  });

  it("removes both the DB row and the job scheduler on delete", async () => {
    const report = await service.create(userId, {
      name: "To be deleted",
      reportType: "ENROLLMENT",
      format: "CSV",
      cadence: "WEEKLY",
    });
    await service.remove(report.id);
    expect(removeJobScheduler).toHaveBeenCalledWith(report.id);
    await expect(service.findByIdOrThrow(report.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("runNow enqueues an immediate job without waiting for the cadence", async () => {
    const report = await service.create(userId, {
      name: "Run now test",
      reportType: "ENROLLMENT",
      format: "CSV",
      cadence: "MONTHLY",
    });
    await service.runNow(report.id);
    expect(add).toHaveBeenCalledWith(
      "run-scheduled-report",
      { scheduledReportId: report.id },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it("throws NotFoundException for a non-existent scheduled report", async () => {
    await expect(
      service.findByIdOrThrow("00000000-0000-4000-8000-000000000000"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
