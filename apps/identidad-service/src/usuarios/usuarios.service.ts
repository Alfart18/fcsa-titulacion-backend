// Ruta: apps/identidad-service/src/usuarios/usuarios.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { EstadoUsuario, RolUsuario } from '../generated/client';
import { IdentidadPrismaService } from '../prisma/identidad-prisma.service';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: IdentidadPrismaService) {}

  async listarUsuarios() {
    return this.prisma.usuario.findMany({
      select: {
        id: true,
        gradoTitulo: true,
        nombresCompletos: true,
        correo: true,
        iniciales: true,
        rol: true,
        estado: true,
        esDecanoFirmante: true,
        creadoEn: true,
      },
      orderBy: { creadoEn: 'asc' },
    });
  }

  async obtenerUsuarioInternoPorId(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        gradoTitulo: true,
        nombresCompletos: true,
        correo: true,
        iniciales: true,
        rol: true,
        estado: true,
        esDecanoFirmante: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException(`No se encontró el usuario con ID "${id}".`);
    }

    return usuario;
  }

  async crearUsuario(
    dto: CrearUsuarioDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const existe = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
    });

    if (existe) {
      throw new BadRequestException(
        'Ya existe un usuario registrado con ese correo institucional.',
      );
    }

    if (dto.esDecanoFirmante && dto.rol !== RolUsuario.DECANO) {
      throw new BadRequestException(
        'Solo un usuario con rol DECANO puede ser marcado como Decano Firmante.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      if (dto.esDecanoFirmante) {
        await tx.usuario.updateMany({
          where: { esDecanoFirmante: true },
          data: { esDecanoFirmante: false },
        });
      }

      const nuevo = await tx.usuario.create({
        data: {
          nombresCompletos: dto.nombresCompletos,
          gradoTitulo: dto.gradoTitulo,
          correo: dto.correo,
          passwordHash,
          iniciales: dto.iniciales,
          rol: dto.rol,
          estado: EstadoUsuario.ACTIVO,
          esDecanoFirmante: Boolean(dto.esDecanoFirmante),
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'GESTION_USUARIO',
          entidad: 'usuarios',
          entidadId: nuevo.id,
          detalle: {
            operacion: 'CREAR_USUARIO',
            correo: nuevo.correo,
            rol: nuevo.rol,
            iniciales: nuevo.iniciales,
            esDecanoFirmante: nuevo.esDecanoFirmante,
          },
        },
      });

      return {
        id: nuevo.id,
        nombresCompletos: nuevo.nombresCompletos,
        correo: nuevo.correo,
        iniciales: nuevo.iniciales,
        rol: nuevo.rol,
        estado: nuevo.estado,
        esDecanoFirmante: nuevo.esDecanoFirmante,
      };
    });
  }

  async actualizarUsuario(
    usuarioIdObjetivo: string,
    dto: ActualizarUsuarioDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const objetivo = await this.prisma.usuario.findUnique({
      where: { id: usuarioIdObjetivo },
    });

    if (!objetivo) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (
      usuarioIdObjetivo === ejecutor.id &&
      dto.estado === EstadoUsuario.DESACTIVADO
    ) {
      throw new BadRequestException(
        'No puede desactivar su propia cuenta en sesión.',
      );
    }

    if (dto.esDecanoFirmante && objetivo.rol !== RolUsuario.DECANO) {
      throw new BadRequestException(
        'Solo un usuario con rol DECANO puede ser designado como Decano Firmante.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.esDecanoFirmante === true) {
        await tx.usuario.updateMany({
          where: {
            esDecanoFirmante: true,
            id: { not: usuarioIdObjetivo },
          },
          data: { esDecanoFirmante: false },
        });
      }

      const actualizado = await tx.usuario.update({
        where: { id: usuarioIdObjetivo },
        data: {
          ...(dto.estado ? { estado: dto.estado } : {}),
          ...(dto.esDecanoFirmante !== undefined
            ? { esDecanoFirmante: dto.esDecanoFirmante }
            : {}),
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'GESTION_USUARIO',
          entidad: 'usuarios',
          entidadId: actualizado.id,
          detalle: {
            operacion: 'ACTUALIZAR_USUARIO',
            correo: actualizado.correo,
            estado: actualizado.estado,
            esDecanoFirmante: actualizado.esDecanoFirmante,
          },
        },
      });

      return {
        id: actualizado.id,
        correo: actualizado.correo,
        estado: actualizado.estado,
        esDecanoFirmante: actualizado.esDecanoFirmante,
      };
    });
  }
}