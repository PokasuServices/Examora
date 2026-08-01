import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { MALWARE_SCANNER_PORT } from "../src/malware-scan/malware-scanner.port";
import { PrismaService } from "../src/prisma/prisma.service";
import { configureApp } from "../src/setup-app";
import { STORAGE_PORT } from "../src/storage/storage.port";
import { registerUserWithRoles } from "./support/auth-helpers";
import {
  EICAR_TEST_STRING,
  FakeMalwareScannerService,
} from "./support/fake-malware-scanner.service";
import { FakeStorageService } from "./support/fake-storage.service";
import { ensureRolesAndPermissions } from "./support/seed-helpers";

/**
 * Sprint 12 CMS & Publishing Workflow e2e (ADR-0022): admin authoring
 * (cms:manage/cms:publish, ADMINISTRATOR-only per TD-045) through the full
 * Draft -> Review -> Approval -> Publish -> Archive lifecycle, version
 * history, media library asset reuse and quarantine-by-default scanning
 * (storage/scanner ports faked, per ADR-0015 precedent), and @Public() reads
 * that only ever surface PUBLISHED content.
 */
describe("CMS & Publishing Workflow (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeStorage: FakeStorageService;
  let adminToken: string;
  let studentToken: string;
  const suffix = `${Date.now()}`;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function waitForAssetScanStatus(
    assetId: string,
    notStatus: string,
    timeoutMs = 15_000,
  ): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/cms/assets/${assetId}`)
        .set(auth(adminToken))
        .expect(200);
      if (res.body.data.scanStatus !== notStatus) {
        return res.body.data.scanStatus;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(`Timed out waiting for asset ${assetId} to leave status ${notStatus}`);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STORAGE_PORT)
      .useClass(FakeStorageService)
      .overrideProvider(MALWARE_SCANNER_PORT)
      .useClass(FakeMalwareScannerService)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    fakeStorage = app.get(STORAGE_PORT);
    await ensureRolesAndPermissions(prisma);

    const admin = await registerUserWithRoles(app, prisma, `s12-admin-${suffix}@example.test`, [
      "ADMINISTRATOR",
    ]);
    adminToken = admin.accessToken;
    const student = await registerUserWithRoles(app, prisma, `s12-student-${suffix}@example.test`, [
      "STUDENT",
    ]);
    studentToken = student.accessToken;
  }, 30_000);

  afterAll(async () => {
    await prisma.cmsContentVersion.deleteMany({});
    await prisma.cmsAssetUsage.deleteMany({});
    await prisma.cmsBanner.deleteMany({ where: { placement: { contains: suffix } } });
    await prisma.cmsAnnouncement.deleteMany({ where: { title: { contains: suffix } } });
    await prisma.cmsFaqItem.deleteMany({ where: { question: { contains: suffix } } });
    await prisma.cmsPage.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.cmsAsset.deleteMany({ where: { fileName: { contains: suffix } } });
    await prisma.user.deleteMany({ where: { email: { contains: `s12-` } } });
    await app.close();
  });

  describe("RBAC", () => {
    it("denies unauthenticated access to admin authoring routes", async () => {
      await request(app.getHttpServer()).get("/api/v1/admin/cms/pages").expect(401);
      await request(app.getHttpServer()).post("/api/v1/admin/cms/pages").send({}).expect(401);
    });

    it("denies a student (no cms:manage/cms:publish) every admin authoring route", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/cms/pages")
        .set(auth(studentToken))
        .expect(403);
      await request(app.getHttpServer())
        .post("/api/v1/admin/cms/faq")
        .set(auth(studentToken))
        .send({ question: "Q?", answer: "A" })
        .expect(403);
    });

    it("allows public, unauthenticated reads of the published-content surfaces", async () => {
      await request(app.getHttpServer()).get("/api/v1/cms/faq").expect(200);
      await request(app.getHttpServer()).get("/api/v1/cms/announcements").expect(200);
      await request(app.getHttpServer()).get("/api/v1/cms/search?q=nothing").expect(200);
    });
  });

  describe("Pages: full Draft -> Review -> Approval -> Publish -> Archive lifecycle", () => {
    let pageId: string;
    const slug = `e2e-page-${suffix}`;

    it("creates a page in DRAFT via cms:manage", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/admin/cms/pages")
        .set(auth(adminToken))
        .send({ pageType: "LANDING", slug, title: "E2E Landing", body: "Hello" })
        .expect(201);
      expect(res.body.data.status).toBe("DRAFT");
      expect(res.body.data.version).toBe(1);
      pageId = res.body.data.id;
    });

    it("404s the public slug route while still DRAFT", async () => {
      await request(app.getHttpServer()).get(`/api/v1/cms/pages/${slug}`).expect(404);
    });

    it("GET :id (preview mode) returns the DRAFT content to an admin regardless of status", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/cms/pages/${pageId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.title).toBe("E2E Landing");
    });

    it("edits the DRAFT and bumps the version", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/cms/pages/${pageId}`)
        .set(auth(adminToken))
        .send({ title: "E2E Landing (Revised)" })
        .expect(200);
      expect(res.body.data.title).toBe("E2E Landing (Revised)");
      expect(res.body.data.version).toBe(2);
    });

    it("rejects skipping straight to PUBLISHED from DRAFT", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/cms/pages/${pageId}/transition`)
        .set(auth(adminToken))
        .send({ targetStatus: "PUBLISHED" })
        .expect(400);
    });

    it("walks Draft -> Review -> Approval -> Publish and the public route now resolves", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/cms/pages/${pageId}/transition`)
        .set(auth(adminToken))
        .send({ targetStatus: "IN_REVIEW" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/admin/cms/pages/${pageId}/transition`)
        .set(auth(adminToken))
        .send({ targetStatus: "APPROVED" })
        .expect(201);
      const published = await request(app.getHttpServer())
        .post(`/api/v1/admin/cms/pages/${pageId}/transition`)
        .set(auth(adminToken))
        .send({ targetStatus: "PUBLISHED" })
        .expect(201);
      expect(published.body.data.status).toBe("PUBLISHED");
      expect(published.body.data.publishedAt).not.toBeNull();

      const publicRes = await request(app.getHttpServer())
        .get(`/api/v1/cms/pages/${slug}`)
        .expect(200);
      expect(publicRes.body.data.title).toBe("E2E Landing (Revised)");

      const listRes = await request(app.getHttpServer())
        .get("/api/v1/cms/pages")
        .query({ pageType: "LANDING" })
        .expect(200);
      expect(listRes.body.data.some((p: { slug: string }) => p.slug === slug)).toBe(true);
    });

    it("lists version history and compares two versions", async () => {
      const versions = await request(app.getHttpServer())
        .get(`/api/v1/admin/cms/pages/${pageId}/versions`)
        .set(auth(adminToken))
        .expect(200);
      expect(versions.body.data.length).toBeGreaterThanOrEqual(4); // created + edit + 3 transitions

      const diff = await request(app.getHttpServer())
        .get(`/api/v1/admin/cms/pages/${pageId}/versions/compare`)
        .query({ from: 1, to: 2 })
        .set(auth(adminToken))
        .expect(200);
      expect(diff.body.data).toEqual(
        expect.arrayContaining([
          { field: "title", before: "E2E Landing", after: "E2E Landing (Revised)" },
        ]),
      );
    });

    it("restores version 1 as a new version and archives the page, removing it from public view", async () => {
      const restored = await request(app.getHttpServer())
        .post(`/api/v1/admin/cms/pages/${pageId}/versions/1/restore`)
        .set(auth(adminToken))
        .expect(201);
      expect(restored.body.data.title).toBe("E2E Landing");

      await request(app.getHttpServer())
        .post(`/api/v1/admin/cms/pages/${pageId}/transition`)
        .set(auth(adminToken))
        .send({ targetStatus: "ARCHIVED" })
        .expect(201);
      await request(app.getHttpServer()).get(`/api/v1/cms/pages/${slug}`).expect(404);
    });
  });

  describe("Pages: scheduled publish", () => {
    it("only allows scheduling a publish from APPROVED, and persists the schedule", async () => {
      const slug = `e2e-scheduled-${suffix}`;
      const create = await request(app.getHttpServer())
        .post("/api/v1/admin/cms/pages")
        .set(auth(adminToken))
        .send({ pageType: "STATIC", slug, title: "Scheduled", body: "A" })
        .expect(201);
      const id = create.body.data.id;

      await request(app.getHttpServer())
        .post(`/api/v1/admin/cms/pages/${id}/schedule-publish`)
        .set(auth(adminToken))
        .send({ at: new Date(Date.now() + 3_600_000).toISOString() })
        .expect(400); // still DRAFT

      await request(app.getHttpServer())
        .post(`/api/v1/admin/cms/pages/${id}/transition`)
        .set(auth(adminToken))
        .send({ targetStatus: "IN_REVIEW" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/admin/cms/pages/${id}/transition`)
        .set(auth(adminToken))
        .send({ targetStatus: "APPROVED" })
        .expect(201);

      const at = new Date(Date.now() + 3_600_000).toISOString();
      const scheduled = await request(app.getHttpServer())
        .post(`/api/v1/admin/cms/pages/${id}/schedule-publish`)
        .set(auth(adminToken))
        .send({ at })
        .expect(201);
      expect(new Date(scheduled.body.data.scheduledPublishAt).toISOString()).toBe(at);
    });
  });

  describe("FAQ", () => {
    it("creates, publishes, and surfaces a FAQ item publicly", async () => {
      const create = await request(app.getHttpServer())
        .post("/api/v1/admin/cms/faq")
        .set(auth(adminToken))
        .send({ question: `E2E FAQ ${suffix}?`, answer: "Because e2e." })
        .expect(201);
      const id = create.body.data.id;

      for (const targetStatus of ["IN_REVIEW", "APPROVED", "PUBLISHED"]) {
        await request(app.getHttpServer())
          .post(`/api/v1/admin/cms/faq/${id}/transition`)
          .set(auth(adminToken))
          .send({ targetStatus })
          .expect(201);
      }

      const publicList = await request(app.getHttpServer()).get("/api/v1/cms/faq").expect(200);
      expect(publicList.body.data.some((f: { id: string }) => f.id === id)).toBe(true);

      const search = await request(app.getHttpServer())
        .get("/api/v1/cms/search")
        .query({ q: `E2E FAQ ${suffix}` })
        .expect(200);
      expect(search.body.data.items.some((r: { contentId: string }) => r.contentId === id)).toBe(
        true,
      );
    });
  });

  describe("Announcements", () => {
    it("creates and publishes an announcement", async () => {
      const create = await request(app.getHttpServer())
        .post("/api/v1/admin/cms/announcements")
        .set(auth(adminToken))
        .send({ title: `E2E Announcement ${suffix}`, body: "Body text" })
        .expect(201);
      const id = create.body.data.id;

      for (const targetStatus of ["IN_REVIEW", "APPROVED", "PUBLISHED"]) {
        await request(app.getHttpServer())
          .post(`/api/v1/admin/cms/announcements/${id}/transition`)
          .set(auth(adminToken))
          .send({ targetStatus })
          .expect(201);
      }

      const publicList = await request(app.getHttpServer())
        .get("/api/v1/cms/announcements")
        .expect(200);
      expect(publicList.body.data.some((a: { id: string }) => a.id === id)).toBe(true);
    });
  });

  describe("Media Library and Banner asset reuse", () => {
    let cleanAssetId: string;
    let infectedAssetId: string;

    it("uploads a clean asset — presign, simulate the browser PUT, confirm, and wait for CLEAN", async () => {
      const presign = await request(app.getHttpServer())
        .post("/api/v1/admin/cms/assets/presign")
        .set(auth(adminToken))
        .send({ fileName: `banner-${suffix}.png`, mimeType: "image/png", sizeBytes: 1024 })
        .expect(201);
      const { key } = presign.body.data;
      fakeStorage.put(key, Buffer.from("a perfectly normal banner image"));

      const confirm = await request(app.getHttpServer())
        .post("/api/v1/admin/cms/assets/confirm")
        .set(auth(adminToken))
        .send({
          storageKey: key,
          fileName: `banner-${suffix}.png`,
          mimeType: "image/png",
          sizeBytes: 1024,
        })
        .expect(201);
      expect(confirm.body.data.scanStatus).toBe("PENDING");
      cleanAssetId = confirm.body.data.id;

      const status = await waitForAssetScanStatus(cleanAssetId, "PENDING");
      expect(status).toBe("CLEAN");
    }, 20_000);

    it("an infected asset is quarantined — deleted from storage, never downloadable", async () => {
      const presign = await request(app.getHttpServer())
        .post("/api/v1/admin/cms/assets/presign")
        .set(auth(adminToken))
        .send({ fileName: `infected-${suffix}.png`, mimeType: "image/png", sizeBytes: 100 })
        .expect(201);
      const { key } = presign.body.data;
      fakeStorage.put(key, Buffer.from(EICAR_TEST_STRING));

      const confirm = await request(app.getHttpServer())
        .post("/api/v1/admin/cms/assets/confirm")
        .set(auth(adminToken))
        .send({
          storageKey: key,
          fileName: `infected-${suffix}.png`,
          mimeType: "image/png",
          sizeBytes: 100,
        })
        .expect(201);
      infectedAssetId = confirm.body.data.id;

      const status = await waitForAssetScanStatus(infectedAssetId, "PENDING");
      expect(status).toBe("INFECTED");
      expect(fakeStorage.has(key)).toBe(false);

      await request(app.getHttpServer())
        .get(`/api/v1/admin/cms/assets/${infectedAssetId}/download-url`)
        .set(auth(adminToken))
        .expect(404);
    }, 20_000);

    it("creating a banner with imageAssetId records asset usage, blocking deletion", async () => {
      const banner = await request(app.getHttpServer())
        .post("/api/v1/admin/cms/banners")
        .set(auth(adminToken))
        .send({
          title: "E2E Banner",
          placement: `HOMEPAGE_TOP-${suffix}`,
          imageAssetId: cleanAssetId,
        })
        .expect(201);
      expect(banner.body.data.imageAssetId).toBe(cleanAssetId);

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/cms/assets/${cleanAssetId}`)
        .set(auth(adminToken))
        .expect(400);
    });

    it("clearing the banner's image (null) frees the asset for deletion", async () => {
      const banners = await request(app.getHttpServer())
        .get("/api/v1/admin/cms/banners")
        .query({ placement: `HOMEPAGE_TOP-${suffix}` })
        .set(auth(adminToken))
        .expect(200);
      const bannerId = banners.body.data.items[0].id;

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/cms/banners/${bannerId}`)
        .set(auth(adminToken))
        .send({ imageAssetId: null })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/cms/assets/${cleanAssetId}`)
        .set(auth(adminToken))
        .expect(204);
    });
  });
});
