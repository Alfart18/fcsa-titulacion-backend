// Ruta: src/app.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ConfiguracionModule } from './configuracion/configuracion.module';
import { PersonasModule } from './personas/personas.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PersonasModule,
    ConfiguracionModule,
    CatalogosModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('{*path}');
  }
}