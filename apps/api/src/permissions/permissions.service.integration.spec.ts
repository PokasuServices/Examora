import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "./permissions.service";

/**
 * Integration test: exercises PermissionsService against the real database
 * and the actual seed data (pnpm db:seed must have run — see README).
 */
describe("PermissionsService (integration)", () => {
  let service: PermissionsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [PermissionsService, PrismaService],
    }).compile();

    service = moduleRef.get(PermissionsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("returns an empty list for no roles", async () => {
    await expect(service.getPermissionsForRoles([])).resolves.toEqual([]);
  });

  it("resolves the seeded baseline permissions for STUDENT", async () => {
    const permissions = await service.getPermissionsForRoles(["STUDENT"]);
    expect(permissions).toEqual(
      expect.arrayContaining(["profile:read:own", "profile:update:own", "sessions:manage:own"]),
    );
    expect(permissions).not.toContain("users:manage");
  });

  it("resolves the full permission set for ADMINISTRATOR", async () => {
    const permissions = await service.getPermissionsForRoles(["ADMINISTRATOR"]);
    expect(permissions).toEqual(
      expect.arrayContaining(["users:manage", "roles:manage", "audit_logs:read"]),
    );
  });

  it("de-duplicates permissions shared across multiple roles", async () => {
    const permissions = await service.getPermissionsForRoles(["STUDENT", "MENTOR"]);
    const occurrences = permissions.filter((code) => code === "profile:read:own");
    expect(occurrences).toHaveLength(1);
  });
});
