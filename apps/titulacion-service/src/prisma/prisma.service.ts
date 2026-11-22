// Ruta: src/prisma/prisma.service.ts
import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EstadoUsuario, Prisma, PrismaClient, RolUsuario } from '../generated/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Resuelve el UUID de usuario válido en el esquema `public` a partir del JWT emitido por `identidad-service`.
   * Evita errores de llave foránea cuando un usuario fue creado solo en `identidad.usuarios`.
   */
  async resolverUsuarioId(
    usuario: { sub?: string; id?: string; iniciales?: string; rol?: RolUsuario } | undefined,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx ?? this;
    const candidateId = usuario?.sub ?? usuario?.id;

    if (candidateId) {
      const porId = await client.usuario.findUnique({
        where: { id: candidateId },
        select: { id: true },
      });
      if (porId) return porId.id;
    }

    if (usuario?.iniciales) {
      const porIniciales = await client.usuario.findFirst({
        where: {
          iniciales: { equals: usuario.iniciales, mode: 'insensitive' },
          estado: EstadoUsuario.ACTIVO,
        },
        select: { id: true },
      });
      if (porIniciales) return porIniciales.id;
    }

    if (usuario?.rol) {
      const porRol = await client.usuario.findFirst({
        where: { rol: usuario.rol, estado: EstadoUsuario.ACTIVO },
        select: { id: true },
      });
      if (porRol) return porRol.id;
    }

    const fallback = await client.usuario.findFirst({
      where: { estado: EstadoUsuario.ACTIVO },
      select: { id: true },
    });
    if (fallback) return fallback.id;

    throw new BadRequestException(
      'No existe ningún usuario activo en el esquema de titulación para asociar la operación.',
    );
  }
}