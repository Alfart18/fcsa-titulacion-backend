import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IdentidadServiceModule } from './identidad-service.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(IdentidadServiceModule);
  
  // 🔥 ESTO ES LO QUE ARREGLA EL FRONTEND
  app.setGlobalPrefix('api'); 
  
  app.enableCors();
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