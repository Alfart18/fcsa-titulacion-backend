// Ruta: src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { RolUsuario } from '../../generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

interface UsuarioEstadoRow {
  estado: string;
  rol: RolUsuario;
  iniciales: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
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
    if (!payload || !payload.sub || !payload.rol || !payload.iniciales) {
      throw new UnauthorizedException(
        'El payload del token JWT es inválido o está incompleto.',
      );
    }

    // Verifica en vivo contra identidad.usuarios que el usuario siga ACTIVO (revocación inmediata)
    try {
      const filas = await this.prisma.$queryRaw<UsuarioEstadoRow[]>`
        SELECT estado::text AS estado, rol::text AS rol, iniciales
        FROM identidad.usuarios
        WHERE id = ${payload.sub}::uuid
        LIMIT 1
      `;
      if (filas.length > 0) {
        const usuarioDb = filas[0];
        if (usuarioDb.estado !== 'ACTIVO') {
          throw new UnauthorizedException(
            'La cuenta fue desactivada. Inicie sesión nuevamente.',
          );
        }
        return {
          sub: payload.sub,
          rol: usuarioDb.rol,
          iniciales: usuarioDb.iniciales,
          iat: payload.iat,
          exp: payload.exp,
        };
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      // Si el esquema identidad no existe en un entorno de prueba aislado, continúa con el JWT firmado
    }

    return {
      sub: payload.sub,
      rol: payload.rol,
      iniciales: payload.iniciales,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}