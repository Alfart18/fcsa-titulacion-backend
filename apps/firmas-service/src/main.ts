import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FirmasServiceModule } from './firmas-service.module';

async function bootstrap() {
  const app = await NestFactory.create(FirmasServiceModule);
  app.enableCors();

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