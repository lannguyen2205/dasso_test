import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import * as cookieParser from "cookie-parser";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { Client } from "pg";
import { AppModule } from "./app.module";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { AppDefaults } from "./common/constants/defaults";

async function ensureSchemaExists(logger: Logger) {
  const dbUrl = process.env.DATABASE_URL;
  const schema = process.env.DB_SCHEMA || "server_a";
  if (!dbUrl) return;

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}";`);
    await client.end();
    logger.log(`📦 PostgreSQL Schema "${schema}" verified on Supabase.`);
  } catch (err) {
    logger.warn(`Could not verify PostgreSQL schema: ${(err as Error).message}`);
  }
}

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  // Ensure PostgreSQL schema exists on Supabase before TypeORM initializes
  await ensureSchemaExists(logger);

  const app = await NestFactory.create(AppModule);

  // Enable CORS with credentials for Frontend Web App
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Enable Cookie Parsing for HTTP-only Refresh Tokens
  app.use(cookieParser());

  // Global DTO Validation Pipe following Bunny Cove standards
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global Standardized Response Envelope & Error Handling
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle(`🛡️ ${AppDefaults.APP.NAME} API`)
    .setDescription(
      `NestJS Backend Service for ${AppDefaults.APP.NAME} featuring Email Registration, OTP Verification, Authentication, and User Management (Bunny Cove Clean Architecture).`,
    )
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "Authorization",
        description: "JWT Access Token (Bearer <token>)",
        in: "header",
      },
      "bearer",
    )
    .addTag(
      "Authentication",
      "Email registration, OTP verification, login, and logout",
    )
    .addTag("Users Management", "User profile and user repository management")
    .addTag("System", "Health check and service status")
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument, {
    customSiteTitle: `🛡️ ${AppDefaults.APP.NAME} Docs`,
  });

  const port = process.env.PORT ?? AppDefaults.APP.PORT;
  await app.listen(port);
  logger.log(`🚀 ${AppDefaults.APP.NAME} running on http://localhost:${port}`);
  logger.log(
    `📚 Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}

void bootstrap();
