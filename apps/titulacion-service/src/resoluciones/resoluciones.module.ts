// Ruta: src/resoluciones/resoluciones.module.ts
import { Module } from '@nestjs/common';
import { ResolucionesController } from './resoluciones.controller';
import { ResolucionesService } from './resoluciones.service';

@Module({
  controllers: [ResolucionesController],
  providers: [ResolucionesService],
  exports: [ResolucionesService],
})
export class ResolucionesModule {}