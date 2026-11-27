// Ruta: src/main.ts
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Carga el .env de la raíz del monorepo
dotenv.config({ path: resolve(__dirname, '../../../.env') });
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Garantiza la serialización JSON de campos BigInt (ej. RegistroAuditoria.id)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (): string {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.setGlobalPrefix('api');

  const allowedOriginsList = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [];
  const lanOriginRegex =
    /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (
        !origin ||
        allowedOriginsList.length === 0 ||
        allowedOriginsList.includes(origin) ||
        (process.env.NODE_ENV !== 'production' && lanOriginRegex.test(origin))
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Origen CORS no permitido: ${origin}`));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  const port = process.env.PORT ? Number(process.env.PORT) : 4001;
  await app.listen(port);
}

void bootstrap();