// Ruta: src/plantillas/plantillas.module.ts
import { Module } from '@nestjs/common';
import { PlantillasService } from './plantillas.service';
import { PlantillasController } from './plantillas.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PlantillasController],
  providers: [PlantillasService],
  exports: [PlantillasService],
})
export class PlantillasModule {}