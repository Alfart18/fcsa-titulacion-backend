import { NestFactory } from '@nestjs/core';
import { IdentidadServiceModule } from './identidad-service.module';

async function bootstrap() {
  const app = await NestFactory.create(IdentidadServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
