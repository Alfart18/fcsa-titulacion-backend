// Ruta: apps/documentos-service/src/main.ts
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Carga el .env de la raíz del monorepo
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { DocumentosServiceModule } from './documentos-service.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(DocumentosServiceModule);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
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
    exposedHeaders: ['Content-Disposition', 'X-Sello-Control'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Documentos Service - FCSa UAC')
      .setDescription(
        'Microservicio Stateless de Generación de Resoluciones en PDF (pdf-lib)',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT_DOCUMENTOS || 4002;
  await app.listen(port);
  console.log(
    `[Documentos-Service FCSa-UAC] Ejecutándose en http://localhost:${port}`,
  );
}
void bootstrap();