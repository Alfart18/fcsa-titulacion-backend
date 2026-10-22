import { Module } from '@nestjs/common';
import { CommonModule } from '@app/common';
import { DocentesController } from './docentes/docentes.controller';
import { DocentesService } from './docentes/docentes.service';
import { ExpedientesController } from './expedientes/expedientes.controller';
import { ExpedientesService } from './expedientes/expedientes.service';
import { ResolucionesController } from './resoluciones/resoluciones.controller';
import { ResolucionesService } from './resoluciones/resoluciones.service';

@Module({
  imports: [CommonModule],
  controllers: [DocentesController, ExpedientesController, ResolucionesController],
  providers: [DocentesService, ExpedientesService, ResolucionesService],
})
export class TitulacionServiceModule {}