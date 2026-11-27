// Ruta: apps/identidad-service/src/auth/auth.service.ts
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { EstadoUsuario } from '../generated/client';
import { IdentidadPrismaService } from '../prisma/identidad-prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: IdentidadPrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    // Verificar contraseña ANTES de informar si la cuenta está desactivada (evita enumeración de cuentas)
    const passwordValido = await bcrypt.compare(
      dto.password,
      usuario.passwordHash,
    );
    if (!passwordValido) {
      await this.prisma.registroAuditoria
        .create({
          data: {
            usuarioId: usuario.id,
            inicialesUsuario: usuario.iniciales,
            accion: 'LOGIN_FALLIDO',
            entidad: 'usuarios',
            entidadId: usuario.id,
            detalle: {
              correo: usuario.correo,
              motivo: 'CONTRASEÑA_INCORRECTA',
            },
          },
        })
        .catch(() => undefined);
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    if (usuario.estado === EstadoUsuario.DESACTIVADO) {
      await this.prisma.registroAuditoria
        .create({
          data: {
            usuarioId: usuario.id,
            inicialesUsuario: usuario.iniciales,
            accion: 'LOGIN_BLOQUEADO_DESACTIVADO',
            entidad: 'usuarios',
            entidadId: usuario.id,
            detalle: {
              correo: usuario.correo,
              motivo: 'CUENTA_DESACTIVADA',
            },
          },
        })
        .catch(() => undefined);
      throw new ForbiddenException(
        'Su cuenta se encuentra DESACTIVADA. Comuníquese con el Decanato de la FCSa.',
      );
    }

    const payload = {
      sub: usuario.id,
      rol: usuario.rol,
      iniciales: usuario.iniciales,
      nombresCompletos: usuario.nombresCompletos,
    };

    await this.prisma.registroAuditoria
      .create({
        data: {
          usuarioId: usuario.id,
          inicialesUsuario: usuario.iniciales,
          accion: 'LOGIN_EXITOSO',
          entidad: 'usuarios',
          entidadId: usuario.id,
          detalle: {
            correo: usuario.correo,
            rol: usuario.rol,
          },
        },
      })
      .catch(() => undefined);

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
}