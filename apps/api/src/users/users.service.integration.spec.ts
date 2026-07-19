import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

describe("UsersService (integration)", () => {
  let service: UsersService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  const testEmails: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [UsersService, PrismaService],
    }).compile();

    service = moduleRef.get(UsersService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await moduleRef.close();
  });

  function uniqueEmail(label: string): string {
    const email = `users-svc-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
    testEmails.push(email);
    return email;
  }

  it("creates a user defaulting to PENDING_VERIFICATION (closes TD-009)", async () => {
    const email = uniqueEmail("create");
    const user = await service.createWithDefaultRole({
      email,
      passwordHash: "hashed",
      defaultRole: "STUDENT",
      consentVersion: "v1.0",
      consentChannel: "web",
    });

    expect(user.status).toBe("PENDING_VERIFICATION");
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.roles.map((r) => r.role.name)).toEqual(["STUDENT"]);
    expect(user.consentVersion).toBe("v1.0");
  });

  it("marks a user ACTIVE and verified on markEmailVerified", async () => {
    const email = uniqueEmail("verify");
    const user = await service.createWithDefaultRole({
      email,
      passwordHash: "hashed",
      defaultRole: "STUDENT",
    });

    const verified = await service.markEmailVerified(user.id);
    expect(verified.status).toBe("ACTIVE");
    expect(verified.emailVerifiedAt).not.toBeNull();
  });

  it("updates profile fields via updateProfile", async () => {
    const email = uniqueEmail("profile");
    const user = await service.createWithDefaultRole({
      email,
      passwordHash: "hashed",
      defaultRole: "STUDENT",
    });

    const updated = await service.updateProfile(user.id, {
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "+15550001111",
    });

    expect(updated.firstName).toBe("Ada");
    expect(updated.lastName).toBe("Lovelace");
    expect(updated.phone).toBe("+15550001111");
  });

  it("replaces role assignments via setRoles", async () => {
    const email = uniqueEmail("roles");
    const user = await service.createWithDefaultRole({
      email,
      passwordHash: "hashed",
      defaultRole: "STUDENT",
    });

    const updated = await service.setRoles(user.id, ["MENTOR", "REVIEWER"]);
    const roleNames = updated?.roles.map((r) => r.role.name).sort();
    expect(roleNames).toEqual(["MENTOR", "REVIEWER"]);
  });

  it("records a consent decision", async () => {
    const email = uniqueEmail("consent");
    const user = await service.createWithDefaultRole({
      email,
      passwordHash: "hashed",
      defaultRole: "STUDENT",
    });

    await service.recordConsent(user.id, {
      type: "MARKETING",
      version: "v1.0",
      channel: "web",
      granted: true,
    });

    const records = await prisma.consentRecord.findMany({ where: { userId: user.id } });
    expect(records).toHaveLength(1);
    expect(records[0]?.type).toBe("MARKETING");
    expect(records[0]?.granted).toBe(true);
  });

  it("paginates the user list", async () => {
    const email = uniqueEmail("list");
    await service.createWithDefaultRole({ email, passwordHash: "hashed", defaultRole: "STUDENT" });

    const { items, total } = await service.list(1, 1);
    expect(items).toHaveLength(1);
    expect(total).toBeGreaterThanOrEqual(1);
  });
});
