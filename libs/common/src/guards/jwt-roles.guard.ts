import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RolUsuario } from '@app/database';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<RolUsuario | string>) =>
  SetMetadata(ROLES_KEY, roles);

interface JwtTokenPayload {
  sub?: string;
  id?: string;
  rol?: string;
  iniciales?: string;
  nombresCompletos?: string;
}

@Injectable()
export class JwtRolesGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Debe iniciar sesión para acceder a este recurso.',
      );
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException(
        'Debe iniciar sesión para acceder a este recurso.',
      );
    }

    let payload: JwtTokenPayload;
    try {
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      payload = await this.jwtService.verifyAsync<JwtTokenPayload>(token, {
        secret,
      });
    } catch {
      throw new UnauthorizedException('Token de sesión inválido o expirado.');
    }

    const userId = payload?.sub || payload?.id;
    if (!userId || !payload?.rol) {
      throw new UnauthorizedException(
        'El payload del token JWT es inválido o está incompleto.',
      );
    }

    req.user = {
      id: userId,
      sub: userId,
      rol: payload.rol,
      iniciales: payload.iniciales || 'SYS',
      nombresCompletos: payload.nombresCompletos || '',
    };

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(payload.rol)) {
      throw new ForbiddenException(
        `Acceso denegado en servidor: Se requiere uno de los siguientes roles: ${requiredRoles.join(', ')}.`,
      );
    }

    return true;
  }
}
