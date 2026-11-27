import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { IdentidadServiceModule } from './identidad-service.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(IdentidadServiceModule);

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
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT_IDENTIDAD || 4000;
  await app.listen(port);
  console.log(`[Identidad-Service FCSa-UAC] Ejecutándose en http://localhost:${port}`);
}
void bootstrap();