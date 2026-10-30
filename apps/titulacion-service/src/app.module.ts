// Ruta: src/app.module.ts
// Ruta: src/app.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { PersonasModule } from './personas/personas.module'; // <-- NUEVO
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [PrismaModule, AuthModule, PersonasModule], // <-- MODIFICADO
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('{*path}');
  }
}