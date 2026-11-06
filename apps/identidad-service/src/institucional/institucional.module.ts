// Ruta: apps/identidad-service/src/institucional/institucional.module.ts
import { Module } from '@nestjs/common';
import { InstitucionalController } from './institucional.controller';
import { InstitucionalService } from './institucional.service';

@Module({
  controllers: [InstitucionalController],
  providers: [InstitucionalService],
  exports: [InstitucionalService],
})
export class InstitucionalModule {}