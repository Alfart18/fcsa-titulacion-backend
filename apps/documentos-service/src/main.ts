import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentosServiceModule } from './documentos-service.module';

async function bootstrap() {
  const app = await NestFactory.create(DocumentosServiceModule);
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT_DOCUMENTOS || 4002;
  await app.listen(port);
  console.log(`[Documentos-Service FCSa-UAC] Ejecutándose en http://localhost:${port}`);
}
bootstrap();