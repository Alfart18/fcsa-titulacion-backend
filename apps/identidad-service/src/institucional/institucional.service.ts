// Ruta: apps/identidad-service/src/institucional/institucional.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoUsuario, RolUsuario } from '../generated/client';
import { IdentidadPrismaService } from '../prisma/identidad-prisma.service';
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto';
import { CambiarDecanoFirmanteDto } from './dto/cambiar-decano-firmante.dto';

@Injectable()
export class InstitucionalService {
  constructor(private readonly prisma: IdentidadPrismaService) {}

  async obtenerDecanoFirmanteVigente() {
    const decano = await this.prisma.usuario.findFirst({
      where: {
        rol: RolUsuario.DECANO,
        estado: EstadoUsuario.ACTIVO,
        esDecanoFirmante: true,
      },
      select: {
        id: true,
        gradoTitulo: true,
        nombresCompletos: true,
        iniciales: true,
        correo: true,
      },
    });

    if (!decano) {
      throw new NotFoundException(
        'No existe un usuario con rol DECANO activo marcado como firmante (esDecanoFirmante = true).',
      );
    }

    return {
      ...decano,
      nombreCompletoFormateado: `${decano.gradoTitulo} ${decano.nombresCompletos}`,
    };
  }

  private async obtenerOCrearFilaInstitucional() {
    const existente = await this.prisma.configuracionInstitucional.findFirst({
      orderBy: { id: 'asc' },
    });

    if (existente) {
      return existente;
    }

    return this.prisma.configuracionInstitucional.create({
      data: {
        id: 1,
        facultad: 'Facultad de Ciencias de la Salud',
        universidad: 'Universidad Andina del Cusco',
        ciudad: 'Cusco',
        siglasFacultad: 'FCSa',
        siglasUniversidad: 'UAC',
        reglamentoMarco: 'Resolución N.º 513-CU-2024-UAC',
      },
    });
  }

  private async obtenerDecanoFirmanteActual() {
    return this.prisma.usuario.findFirst({
      where: {
        esDecanoFirmante: true,
        estado: EstadoUsuario.ACTIVO,
      },
      select: {
        id: true,
        nombresCompletos: true,
        gradoTitulo: true,
        correo: true,
        iniciales: true,
        rol: true,
        estado: true,
        esDecanoFirmante: true,
      },
    });
  }

  async obtenerConfiguracion() {
    const [institucional, decanoFirmante] = await Promise.all([
      this.obtenerOCrearFilaInstitucional(),
      this.obtenerDecanoFirmanteActual(),
    ]);

    return {
      institucional,
      decanoFirmante,
    };
  }

  async actualizarConfiguracion(
    dto: ActualizarConfiguracionDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const actual = await this.obtenerOCrearFilaInstitucional();

    const institucionalActualizada = await this.prisma.$transaction(
      async (tx) => {
        const actualizada = await tx.configuracionInstitucional.update({
          where: { id: actual.id },
          data: {
            reglamentoMarco: dto.reglamentoMarco.trim(),
          },
        });

        await tx.registroAuditoria.create({
          data: {
            usuarioId: ejecutor.id,
            inicialesUsuario: ejecutor.iniciales,
            accion: 'ACTUALIZAR_CONFIGURACION_INSTITUCIONAL',
            entidad: 'configuracion_institucional',
            entidadId: String(actualizada.id),
            detalle: {
              reglamentoMarcoAnterior: actual.reglamentoMarco,
              reglamentoMarcoNuevo: actualizada.reglamentoMarco,
            },
          },
        });

        return actualizada;
      },
    );

    const decanoFirmante = await this.obtenerDecanoFirmanteActual();

    return {
      institucional: institucionalActualizada,
      decanoFirmante,
    };
  }

  async cambiarDecanoFirmante(
    dto: CambiarDecanoFirmanteDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const candidato = await this.prisma.usuario.findUnique({
      where: { id: dto.usuarioId },
    });

    if (!candidato) {
      throw new NotFoundException(
        `No se encontró el usuario con ID "${dto.usuarioId}".`,
      );
    }

    if (candidato.estado !== EstadoUsuario.ACTIVO) {
      throw new BadRequestException(
        'El usuario seleccionado no se encuentra activo y no puede ser asignado como decano firmante.',
      );
    }

    if (candidato.rol !== RolUsuario.DECANO) {
      throw new BadRequestException(
        'El usuario seleccionado debe tener el rol DECANO para ser designado como decano firmante.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.updateMany({
        where: { esDecanoFirmante: true },
        data: { esDecanoFirmante: false },
      });

      await tx.usuario.update({
        where: { id: candidato.id },
        data: { esDecanoFirmante: true },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'CAMBIAR_DECANO_FIRMANTE',
          entidad: 'usuarios',
          entidadId: candidato.id,
          detalle: {
            nuevoDecanoId: candidato.id,
            nombresCompletos: candidato.nombresCompletos,
            correo: candidato.correo,
          },
        },
      });
    });

    return this.obtenerConfiguracion();
  }
}