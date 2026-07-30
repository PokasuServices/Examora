import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationTemplatesService } from "./notification-templates.service";

describe("NotificationTemplatesService (integration)", () => {
  let service: NotificationTemplatesService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  const eventType = `test.event.${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [NotificationTemplatesService, PrismaService],
    }).compile();
    service = moduleRef.get(NotificationTemplatesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.notificationTemplate.deleteMany({ where: { eventType } });
    await moduleRef.close();
  });

  it("creates a template", async () => {
    const template = await service.create({
      eventType,
      channel: "EMAIL",
      subject: "Hello {{name}}",
      bodyTemplate: "Welcome, {{name}}!",
    });
    expect(template.eventType).toBe(eventType);
    expect(template.channel).toBe("EMAIL");
    expect(template.isActive).toBe(true);
  });

  it("rejects a duplicate (eventType, channel) pair", async () => {
    await expect(
      service.create({ eventType, channel: "EMAIL", bodyTemplate: "dup" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("allows the same eventType on a different channel", async () => {
    const template = await service.create({
      eventType,
      channel: "SMS",
      bodyTemplate: "SMS body {{name}}",
    });
    expect(template.channel).toBe("SMS");
  });

  it("findActive returns null when no active template exists for the pair", async () => {
    const found = await service.findActive(eventType, "WHATSAPP");
    expect(found).toBeNull();
  });

  it("findActive returns the template once one is created and active", async () => {
    const found = await service.findActive(eventType, "EMAIL");
    expect(found?.eventType).toBe(eventType);
  });

  it("findActive ignores an inactive template", async () => {
    const created = await service.create({
      eventType: `${eventType}.inactive`,
      channel: "EMAIL",
      bodyTemplate: "inactive body",
      isActive: false,
    });
    const found = await service.findActive(created.eventType, "EMAIL");
    expect(found).toBeNull();
    await prisma.notificationTemplate.deleteMany({ where: { eventType: created.eventType } });
  });

  it("update() changes fields and throws NotFoundException for a missing id", async () => {
    const template = await service.findActive(eventType, "EMAIL");
    const updated = await service.update(template!.id, { isActive: false });
    expect(updated.isActive).toBe(false);

    await expect(
      service.update("00000000-0000-4000-8000-000000000000", { isActive: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("render() substitutes {{key}} placeholders and leaves unknown keys untouched", () => {
    const rendered = service.render("Hi {{name}}, your code is {{code}}.", { name: "Sam" });
    expect(rendered).toBe("Hi Sam, your code is {{code}}.");
  });

  it("list() paginates results", async () => {
    const { items, total } = await service.list({ page: 1, pageSize: 1 });
    expect(items.length).toBeLessThanOrEqual(1);
    expect(total).toBeGreaterThanOrEqual(2);
  });
});
