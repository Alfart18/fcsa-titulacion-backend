// Ruta: apps/identidad-service/src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { IdentidadPrismaService } from './identidad-prisma.service';

@Global()
@Module({
  providers: [IdentidadPrismaService],
  exports: [IdentidadPrismaService],
})
export class PrismaModule {}