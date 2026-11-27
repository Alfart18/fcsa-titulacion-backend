// Ruta: apps/identidad-service/src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { EstadoUsuario } from '../../generated/client';
import { IdentidadPrismaService } from '../../prisma/identidad-prisma.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: IdentidadPrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('La variable de entorno JWT_SECRET no está definida.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const userId = payload?.sub || payload?.id;
    if (!payload || !userId || !payload.rol || !payload.iniciales) {
      throw new UnauthorizedException(
        'El payload del token JWT es inválido o está incompleto.',
      );
    }

    // Verificación en vivo de estado ACTIVO y rol vigente (revocación inmediata al desactivar)
    const usuarioDb = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        rol: true,
        estado: true,
        iniciales: true,
        nombresCompletos: true,
      },
    });

    if (!usuarioDb || usuarioDb.estado !== EstadoUsuario.ACTIVO) {
      throw new UnauthorizedException(
        'La cuenta fue desactivada o ya no existe. Inicie sesión nuevamente.',
      );
    }

    return {
      id: usuarioDb.id,
      sub: usuarioDb.id,
      rol: usuarioDb.rol,
      iniciales: usuarioDb.iniciales,
      nombresCompletos: usuarioDb.nombresCompletos,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}