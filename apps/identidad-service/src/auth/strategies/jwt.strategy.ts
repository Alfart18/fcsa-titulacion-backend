// Ruta: apps/identidad-service/src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
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

  validate(payload: JwtPayload): JwtPayload {
    const userId = payload?.sub || payload?.id;
    if (!payload || !userId || !payload.rol || !payload.iniciales) {
      throw new UnauthorizedException(
        'El payload del token JWT es inválido o está incompleto.',
      );
    }

    return {
      id: userId,
      sub: userId,
      rol: payload.rol,
      iniciales: payload.iniciales,
      nombresCompletos: payload.nombresCompletos,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}