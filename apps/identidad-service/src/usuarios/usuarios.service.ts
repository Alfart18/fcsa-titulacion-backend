// Ruta: apps/identidad-service/src/usuarios/usuarios.service.ts
import {
  BadRequestException,
  ForbiddenException,
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
    ejecutor: { id: string; iniciales: string; rol?: RolUsuario },
  ) {
    if (dto.rol === RolUsuario.ADMIN && ejecutor.rol && ejecutor.rol !== RolUsuario.ADMIN) {
      throw new ForbiddenException(
        'Solo un usuario con rol ADMIN puede crear cuentas de Administrador.',
      );
    }

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

      // Sincronizar usuario espejo en esquema public para mantener consistencia de FK y Decano Firmante
      try {
        if (nuevo.esDecanoFirmante) {
          await tx.$executeRaw`UPDATE public.usuarios SET "esDecanoFirmante" = false WHERE "esDecanoFirmante" = true`;
        }
        await tx.$executeRaw`
          INSERT INTO public.usuarios (
            id, "nombresCompletos", "gradoTitulo", correo, "passwordHash", iniciales, rol, estado, "esDecanoFirmante", "creadoEn", "actualizadoEn"
          ) VALUES (
            ${nuevo.id}::uuid, ${nuevo.nombresCompletos}, ${nuevo.gradoTitulo}, ${nuevo.correo}, ${nuevo.passwordHash}, ${nuevo.iniciales}, ${nuevo.rol}::public."RolUsuario", ${nuevo.estado}::public."EstadoUsuario", ${nuevo.esDecanoFirmante}, NOW(), NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            "nombresCompletos" = EXCLUDED."nombresCompletos",
            "gradoTitulo" = EXCLUDED."gradoTitulo",
            iniciales = EXCLUDED.iniciales,
            rol = EXCLUDED.rol,
            estado = EXCLUDED.estado,
            "esDecanoFirmante" = EXCLUDED."esDecanoFirmante",
            "actualizadoEn" = NOW()
        `;
      } catch {
        // Ignorar si el esquema public no existe en entorno aislado
      }

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
    ejecutor: { id: string; iniciales: string; rol?: RolUsuario },
  ) {
    const objetivo = await this.prisma.usuario.findUnique({
      where: { id: usuarioIdObjetivo },
    });

    if (!objetivo) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const ejecutorEsAdmin = !ejecutor.rol || ejecutor.rol === RolUsuario.ADMIN;
    if (!ejecutorEsAdmin) {
      if (objetivo.rol === RolUsuario.ADMIN) {
        throw new ForbiddenException(
          'Solo un usuario con rol ADMIN puede modificar o restablecer la contraseña de una cuenta ADMIN.',
        );
      }
      if (dto.rol === RolUsuario.ADMIN) {
        throw new ForbiddenException(
          'Solo un usuario con rol ADMIN puede asignar el rol de Administrador.',
        );
      }
    }

    if (
      usuarioIdObjetivo === ejecutor.id &&
      dto.estado === EstadoUsuario.DESACTIVADO
    ) {
      throw new BadRequestException(
        'No puede desactivar su propia cuenta en sesión.',
      );
    }

    if (
      usuarioIdObjetivo === ejecutor.id &&
      dto.rol !== undefined &&
      dto.rol !== objetivo.rol
    ) {
      throw new BadRequestException(
        'No puede cambiar el rol de su propia cuenta mientras está en sesión.',
      );
    }

    if (dto.correo && dto.correo !== objetivo.correo) {
      const correoOcupado = await this.prisma.usuario.findUnique({
        where: { correo: dto.correo },
        select: { id: true },
      });
      if (correoOcupado && correoOcupado.id !== usuarioIdObjetivo) {
        throw new BadRequestException(
          'Ya existe otro usuario registrado con ese correo institucional.',
        );
      }
    }

    const rolFinal = dto.rol ?? objetivo.rol;
    const estadoFinal = dto.estado ?? objetivo.estado;

    if (dto.esDecanoFirmante === true && rolFinal !== RolUsuario.DECANO) {
      throw new BadRequestException(
        'Solo un usuario con rol DECANO puede ser designado como Decano Firmante.',
      );
    }

    if (dto.esDecanoFirmante === true && estadoFinal !== EstadoUsuario.ACTIVO) {
      throw new BadRequestException(
        'Solo un usuario ACTIVO puede ser designado como Decano Firmante.',
      );
    }

    let esDecanoFirmanteFinal =
      dto.esDecanoFirmante !== undefined
        ? dto.esDecanoFirmante
        : objetivo.esDecanoFirmante;
    if (rolFinal !== RolUsuario.DECANO || estadoFinal !== EstadoUsuario.ACTIVO) {
      esDecanoFirmanteFinal = false;
    }

    const nuevaPasswordHash = dto.nuevaPassword
      ? await bcrypt.hash(dto.nuevaPassword, 10)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (esDecanoFirmanteFinal === true) {
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
          ...(dto.nombresCompletos !== undefined
            ? { nombresCompletos: dto.nombresCompletos }
            : {}),
          ...(dto.gradoTitulo !== undefined
            ? { gradoTitulo: dto.gradoTitulo }
            : {}),
          ...(dto.correo !== undefined ? { correo: dto.correo } : {}),
          ...(dto.iniciales !== undefined ? { iniciales: dto.iniciales } : {}),
          ...(dto.rol !== undefined ? { rol: dto.rol } : {}),
          ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
          ...(nuevaPasswordHash ? { passwordHash: nuevaPasswordHash } : {}),
          esDecanoFirmante: esDecanoFirmanteFinal,
        },
      });

      const camposModificados: string[] = [];
      if (dto.nombresCompletos !== undefined && dto.nombresCompletos !== objetivo.nombresCompletos) {
        camposModificados.push('nombresCompletos');
      }
      if (dto.gradoTitulo !== undefined && dto.gradoTitulo !== objetivo.gradoTitulo) {
        camposModificados.push('gradoTitulo');
      }
      if (dto.correo !== undefined && dto.correo !== objetivo.correo) {
        camposModificados.push('correo');
      }
      if (dto.iniciales !== undefined && dto.iniciales !== objetivo.iniciales) {
        camposModificados.push('iniciales');
      }
      if (dto.rol !== undefined && dto.rol !== objetivo.rol) {
        camposModificados.push('rol');
      }
      if (dto.estado !== undefined && dto.estado !== objetivo.estado) {
        camposModificados.push('estado');
      }
      if (esDecanoFirmanteFinal !== objetivo.esDecanoFirmante) {
        camposModificados.push('esDecanoFirmante');
      }
      if (nuevaPasswordHash) {
        camposModificados.push('password');
      }

      const soloPassword =
        camposModificados.length === 1 && camposModificados[0] === 'password';

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: soloPassword ? 'RESTABLECER_CONTRASENA' : 'GESTION_USUARIO',
          entidad: 'usuarios',
          entidadId: actualizado.id,
          detalle: {
            operacion: soloPassword ? 'RESTABLECER_CONTRASENA' : 'ACTUALIZAR_USUARIO',
            correo: actualizado.correo,
            rolAnterior: objetivo.rol,
            rolNuevo: actualizado.rol,
            estado: actualizado.estado,
            esDecanoFirmante: actualizado.esDecanoFirmante,
            passwordRestablecida: Boolean(nuevaPasswordHash),
            camposModificados,
          },
        },
      });

      // Sincronizar cambios completos en esquema public
      try {
        if (actualizado.esDecanoFirmante) {
          await tx.$executeRaw`UPDATE public.usuarios SET "esDecanoFirmante" = false WHERE "esDecanoFirmante" = true AND id <> ${actualizado.id}::uuid`;
        }
        await tx.$executeRaw`
          UPDATE public.usuarios
          SET "nombresCompletos" = ${actualizado.nombresCompletos},
              "gradoTitulo" = ${actualizado.gradoTitulo},
              correo = ${actualizado.correo},
              "passwordHash" = ${actualizado.passwordHash},
              iniciales = ${actualizado.iniciales},
              rol = ${actualizado.rol}::public."RolUsuario",
              estado = ${actualizado.estado}::public."EstadoUsuario",
              "esDecanoFirmante" = ${actualizado.esDecanoFirmante},
              "actualizadoEn" = NOW()
          WHERE id = ${actualizado.id}::uuid OR correo = ${objetivo.correo}
        `;
      } catch {
        // Ignorar si el esquema public no existe en entorno aislado
      }

      return {
        id: actualizado.id,
        gradoTitulo: actualizado.gradoTitulo,
        nombresCompletos: actualizado.nombresCompletos,
        correo: actualizado.correo,
        iniciales: actualizado.iniciales,
        rol: actualizado.rol,
        estado: actualizado.estado,
        esDecanoFirmante: actualizado.esDecanoFirmante,
        passwordRestablecida: Boolean(nuevaPasswordHash),
      };
    });
  }

  async listarActividadUsuario(usuarioId: string) {
    const existe = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true },
    });
    if (!existe) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const registros = await this.prisma.registroAuditoria.findMany({
      where: {
        OR: [{ usuarioId }, { entidad: 'usuarios', entidadId: usuarioId }],
      },
      orderBy: { fechaHora: 'desc' },
      take: 15,
      select: {
        id: true,
        accion: true,
        entidad: true,
        inicialesUsuario: true,
        detalle: true,
        fechaHora: true,
      },
    });

    return registros.map((r) => ({
      ...r,
      id: r.id.toString(),
    }));
  }
}