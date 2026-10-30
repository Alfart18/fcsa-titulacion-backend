// Ruta: src/configuracion/configuracion.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoUsuario, RolUsuario } from '../generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto';
import { CambiarDecanoFirmanteDto } from './dto/cambiar-decano-firmante.dto';
import type {
  ConfiguracionCompletaResponse,
  DecanoFirmanteResponse,
} from './dto/response/configuracion.response';

@Injectable()
export class ConfiguracionService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async obtenerDecanoFirmanteActual(): Promise<DecanoFirmanteResponse | null> {
    const decano = await this.prisma.usuario.findFirst({
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

    return decano;
  }

  async obtenerConfiguracion(): Promise<ConfiguracionCompletaResponse> {
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
  ): Promise<ConfiguracionCompletaResponse> {
    const actual = await this.obtenerOCrearFilaInstitucional();

    const institucionalActualizada =
      await this.prisma.configuracionInstitucional.update({
        where: { id: actual.id },
        data: {
          reglamentoMarco: dto.reglamentoMarco.trim(),
        },
      });

    const decanoFirmante = await this.obtenerDecanoFirmanteActual();

    return {
      institucional: institucionalActualizada,
      decanoFirmante,
    };
  }

  async cambiarDecanoFirmante(
    dto: CambiarDecanoFirmanteDto,
  ): Promise<ConfiguracionCompletaResponse> {
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

    await this.prisma.$transaction([
      this.prisma.usuario.updateMany({
        where: { esDecanoFirmante: true },
        data: { esDecanoFirmante: false },
      }),
      this.prisma.usuario.update({
        where: { id: candidato.id },
        data: { esDecanoFirmante: true },
      }),
    ]);

    return this.obtenerConfiguracion();
  }
}