import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { ResponseInterceptor } from "../src/common/interceptors/response.interceptor";

describe("Auth + tenant isolation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userAEmail = `user-a-${Date.now()}@test.dev`;
  const userBEmail = `user-b-${Date.now()}@test.dev`;
  const password = "Password123!";

  let userAToken: string;
  let userBToken: string;
  let orgAId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api", { exclude: ["health", "health/(.*)"] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [userAEmail, userBEmail] } } });
    await app.close();
  });

  it("registers user A and returns an access token", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ fullName: "User A", email: userAEmail, password })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    userAToken = res.body.data.accessToken;
  });

  it("registers user B", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ fullName: "User B", email: userBEmail, password })
      .expect(201);
    userBToken = res.body.data.accessToken;
  });

  it("rejects login with the wrong password", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: userAEmail, password: "WrongPassword1" })
      .expect(401);
  });

  it("lets user A create a workspace", async () => {
    const slug = `org-a-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ name: "Org A", slug })
      .expect(201);
    orgAId = res.body.data.id;
    expect(orgAId).toBeDefined();
  });

  it("blocks user B from reading user A's workspace (tenant isolation)", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}`)
      .set("Authorization", `Bearer ${userBToken}`)
      .expect(403);
  });

  it("blocks unauthenticated requests entirely", async () => {
    await request(app.getHttpServer()).get(`/api/v1/organizations/${orgAId}`).expect(401);
  });

  it("lets user A read their own workspace", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(200);
  });
});
