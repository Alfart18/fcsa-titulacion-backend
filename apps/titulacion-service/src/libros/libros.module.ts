// Ruta: src/libros/libros.module.ts
import { Module } from '@nestjs/common';
import { LibrosService } from './libros.service';
import { LibrosController } from './libros.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LibrosController],
  providers: [LibrosService],
  exports: [LibrosService],
})
export class LibrosModule {}