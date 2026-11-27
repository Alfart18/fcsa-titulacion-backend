import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { FirmasServiceModule } from './firmas-service.module';

async function bootstrap() {
  const app = await NestFactory.create(FirmasServiceModule);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

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
    exposedHeaders: [
      'Content-Disposition',
      'X-Total-Resoluciones',
      'X-PDF-Firmado-SHA256',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT_FIRMAS || 4003;
  await app.listen(port);
  console.log(`[Firmas-Service FCSa-UAC] Ejecutándose en http://localhost:${port}`);
}
void bootstrap();