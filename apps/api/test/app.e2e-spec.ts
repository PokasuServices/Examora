import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/setup-app";

describe("Health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/health/live (GET) reports ok without touching dependencies", () => {
    return request(app.getHttpServer())
      .get("/health/live")
      .expect(200)
      .expect((res) => {
        expect(res.body.data ?? res.body).toMatchObject({ status: "ok" });
      });
  });

  it("/health/ready (GET) reports database and redis are reachable", () => {
    return request(app.getHttpServer()).get("/health/ready").expect(200);
  });
});
