import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { createLogger } from "@clouddeploy/logger";

// Prisma maps Postgres BIGINT columns (sizeBytes on DatabaseBackup,
// StorageObject, BuildArtifact) to native BigInt, which JSON.stringify
// cannot serialize on its own. Every response passes through Express's
// res.json() -> JSON.stringify, so this one global fix (stringify BigInts,
// same as Node's own JSON.stringify(BigInt) error suggests) covers every
// route rather than converting the type at each call site.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};

const logger = createLogger("api");

async function bootstrap() {
  // rawBody: true makes req.rawBody available on every route so the Stripe
  // webhook handler can verify signatures, while every other route still
  // gets the normal parsed JSON body.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  const configuredOrigin = process.env.WEB_APP_URL ?? "http://localhost:3000";

  app.use(helmet());
  app.use(cookieParser(process.env.COOKIE_SECRET));
  app.enableCors({
    origin: [configuredOrigin, "http://localhost:3000"],
    credentials: true,
  });

  app.setGlobalPrefix("api", { exclude: ["health", "health/(.*)"] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("CloudDeploy API")
    .setDescription(
      "Control-plane REST API for CloudDeploy — deploy your entire application: frontend, backend, database, storage, domains and SSL from one platform.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("auth")
    .addTag("organizations")
    .addTag("projects")
    .addTag("services")
    .addTag("deployments")
    .addTag("databases")
    .addTag("domains")
    .addTag("environment-variables")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  logger.info(`CloudDeploy API listening on http://localhost:${port}`);
  logger.info(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  logger.error({ err }, "Failed to bootstrap API");
  process.exit(1);
});
