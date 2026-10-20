import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@app/database';
import { EstadoUsuario, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';

@Injectable()
export class IdentidadServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    if (usuario.estado === EstadoUsuario.DESACTIVADO) {
      throw new ForbiddenException(
        'Su cuenta se encuentra DESACTIVADA. Comuníquese con el Decanato de la FCSa.',
      );
    }

    const passwordValido = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    const payload = {
      sub: usuario.id,
      rol: usuario.rol,
      iniciales: usuario.iniciales,
      nombresCompletos: usuario.nombresCompletos,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      usuario: {
        id: usuario.id,
        nombresCompletos: `${usuario.gradoTitulo} ${usuario.nombresCompletos}`,
        correo: usuario.correo,
        iniciales: usuario.iniciales,
        rol: usuario.rol,
        esDecanoFirmante: usuario.esDecanoFirmante,
      },
    };
  }

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

  async crearUsuario(dto: CrearUsuarioDto, ejecutor: { id: string; iniciales: string }) {
    const existe = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
    });
    if (existe) {
      throw new BadRequestException('Ya existe un usuario registrado con ese correo institucional.');
    }

    if (dto.esDecanoFirmante && dto.rol !== RolUsuario.DECANO) {
      throw new BadRequestException('Solo un usuario con rol DECANO puede ser marcado como Decano firmante.');
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
    const objetivo = await this.prisma.usuario.findUnique({ where: { id: usuarioIdObjetivo } });
    if (!objetivo) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (usuarioIdObjetivo === ejecutor.id && dto.estado === EstadoUsuario.DESACTIVADO) {
      throw new BadRequestException('No puede desactivar su propia cuenta en sesión.');
    }

    if (dto.esDecanoFirmante && objetivo.rol !== RolUsuario.DECANO) {
      throw new BadRequestException('Solo un usuario con rol DECANO puede ser designado como firmante.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.esDecanoFirmante === true) {
        await tx.usuario.updateMany({
          where: { esDecanoFirmante: true, id: { not: usuarioIdObjetivo } },
          data: { esDecanoFirmante: false },
        });
      }

      const actualizado = await tx.usuario.update({
        where: { id: usuarioIdObjetivo },
        data: {
          ...(dto.estado ? { estado: dto.estado } : {}),
          ...(dto.esDecanoFirmante !== undefined ? { esDecanoFirmante: dto.esDecanoFirmante } : {}),
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

  async listarAuditoriaGlobal(filtros?: { usuarioId?: string; accion?: string }) {
    const registros = await this.prisma.registroAuditoria.findMany({
      where: {
        ...(filtros?.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
        ...(filtros?.accion ? { accion: filtros.accion } : {}),
      },
      include: {
        usuario: {
          select: {
            nombresCompletos: true,
            rol: true,
          },
        },
      },
      orderBy: { fechaHora: 'desc' },
      take: 200,
    });

    return registros.map((r) => ({
      ...r,
      id: r.id.toString(),
    }));
  }

  async listarMiActividad(usuarioIdAutenticado: string) {
    const registros = await this.prisma.registroAuditoria.findMany({
      where: {
        usuarioId: usuarioIdAutenticado,
      },
      orderBy: { fechaHora: 'desc' },
      take: 100,
    });

    return registros.map((r) => ({
      ...r,
      id: r.id.toString(),
    }));
  }
}