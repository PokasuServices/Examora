import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationPreferencesService } from "./notification-preferences.service";

describe("NotificationPreferencesService (integration)", () => {
  let service: NotificationPreferencesService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let userId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [NotificationPreferencesService, PrismaService],
    }).compile();
    service = moduleRef.get(NotificationPreferencesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { email: `notif-prefs-${Date.now()}@example.test`, status: "ACTIVE" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.notificationPreference.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await moduleRef.close();
  });

  it("creates a default preference row on first read", async () => {
    const pref = await service.getOrCreate(userId);
    expect(pref.userId).toBe(userId);
    expect(pref.emailEnabled).toBe(true);
    expect(pref.mutedCategories).toEqual([]);
    expect(pref.dndStartMinute).toBeNull();
  });

  it("returns the same row on a second call rather than creating a duplicate", async () => {
    const first = await service.getOrCreate(userId);
    const second = await service.getOrCreate(userId);
    expect(second.id).toBe(first.id);

    const count = await prisma.notificationPreference.count({ where: { userId } });
    expect(count).toBe(1);
  });

  it("persists an update, creating the row lazily if it doesn't exist yet", async () => {
    const other = await prisma.user.create({
      data: { email: `notif-prefs-update-${Date.now()}@example.test`, status: "ACTIVE" },
    });
    try {
      const updated = await service.update(other.id, {
        emailEnabled: false,
        mutedCategories: ["community"],
        dndStartMinute: 1320,
        dndEndMinute: 360,
        language: "hi",
        timezone: "Asia/Kolkata",
      });
      expect(updated.emailEnabled).toBe(false);
      expect(updated.mutedCategories).toEqual(["community"]);
      expect(updated.dndStartMinute).toBe(1320);
      expect(updated.dndEndMinute).toBe(360);
      expect(updated.language).toBe("hi");
      expect(updated.timezone).toBe("Asia/Kolkata");
    } finally {
      await prisma.notificationPreference.deleteMany({ where: { userId: other.id } });
      await prisma.user.deleteMany({ where: { id: other.id } });
    }
  });
});
