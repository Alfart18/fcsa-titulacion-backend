import { Module } from '@nestjs/common';
import { CommonModule } from '@app/common';
import { DocentesController } from './docentes/docentes.controller';
import { DocentesService } from './docentes/docentes.service';
import { ExpedientesController } from './expedientes/expedientes.controller';
import { ExpedientesService } from './expedientes/expedientes.service';

@Module({
  imports: [CommonModule],
  controllers: [DocentesController, ExpedientesController],
  providers: [DocentesService, ExpedientesService],
})
export class TitulacionServiceModule {}