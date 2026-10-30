// Ruta: src/main.ts
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Carga el .env de la raíz del monorepo
dotenv.config({ path: resolve(__dirname, '../../../.env') });
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Garantiza la serialización JSON de campos BigInt (ej. RegistroAuditoria.id)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (): string {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
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