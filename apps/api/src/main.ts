import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { logSafeRuntimeSummary, resolveCorsOrigins } from './config/runtime.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3002);
  const corsOrigins = resolveCorsOrigins(configService);
  const trustProxy = configService.get<boolean>('TRUST_PROXY', false);

  if (trustProxy) {
    const httpAdapter = app.getHttpAdapter().getInstance();
    httpAdapter.set('trust proxy', 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      stopAtFirstError: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  logSafeRuntimeSummary(configService, new Logger('Bootstrap'));
  app.enableShutdownHooks();
  await app.listen(port);
  Logger.log(`ROI backend is running on port ${port}`, 'Bootstrap');
}

void bootstrap();
