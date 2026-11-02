// Ruta: src/expedientes/expedientes.module.ts
import { Module } from '@nestjs/common';
import { ExpedientesController } from './expedientes.controller';
import { ExpedientesService } from './expedientes.service';

@Module({
  controllers: [ExpedientesController],
  providers: [ExpedientesService],
  exports: [ExpedientesService],
})
export class ExpedientesModule {}