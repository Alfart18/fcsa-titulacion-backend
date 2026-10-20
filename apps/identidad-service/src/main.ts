import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IdentidadServiceModule } from './identidad-service.module';

async function bootstrap() {
  const app = await NestFactory.create(IdentidadServiceModule);
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`[Identidad-Service FCSa-UAC] Ejecutándose en http://localhost:${port}`);
}
bootstrap();