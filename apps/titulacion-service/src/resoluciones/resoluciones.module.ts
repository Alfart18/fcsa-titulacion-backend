// Ruta: src/resoluciones/resoluciones.module.ts
import { Module } from '@nestjs/common';
import { LibrosModule } from '../libros/libros.module';
import { ResolucionesController } from './resoluciones.controller';
import { ResolucionesService } from './resoluciones.service';

@Module({
  imports: [LibrosModule],
  controllers: [ResolucionesController],
  providers: [ResolucionesService],
  exports: [ResolucionesService],
})
export class ResolucionesModule {}