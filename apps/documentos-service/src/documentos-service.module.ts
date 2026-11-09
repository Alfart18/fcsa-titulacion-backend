import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { DocumentosServiceController } from './documentos-service.controller';
import { DocumentosServiceService } from './documentos-service.service';
import { PdfGeneratorService } from './pdf/pdf-generator.service';
import { ResolucionTemplatesService } from './templates/resolucion-templates.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    AuthModule,
    ClientsModule,
  ],
  controllers: [DocumentosServiceController],
  providers: [
    DocumentosServiceService,
    ResolucionTemplatesService,
    PdfGeneratorService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class DocumentosServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('{*path}');
  }
}