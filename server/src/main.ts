import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend applications (e.g. Vercel)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global standardized Response & Error handling (Bunny Cove rules)
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Support Railway dynamic port or default to 4000
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  logger.log(`🚀 DaSSO Backend Gateway running on http://localhost:${port}`);
}

void bootstrap();

//NOTE: TEST
