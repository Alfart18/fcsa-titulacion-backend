import { Module } from '@nestjs/common';
import { CommonModule } from '@app/common';
import { DocentesController } from './docentes/docentes.controller';
import { DocentesService } from './docentes/docentes.service';

@Module({
  imports: [CommonModule],
  controllers: [DocentesController],
  providers: [DocentesService],
})
export class TitulacionServiceModule {}
