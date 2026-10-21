import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { TitulacionServiceModule } from './titulacion-service.module';

async function bootstrap() {
  const app = await NestFactory.create(TitulacionServiceModule);
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT_TITULACION || 4001;
  await app.listen(port);
  console.log(`[Titulacion-Service FCSa-UAC] Ejecutándose en http://localhost:${port}`);
}
void bootstrap();