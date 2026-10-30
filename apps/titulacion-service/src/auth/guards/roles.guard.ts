// Ruta: src/auth/guards/roles.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RolUsuario } from '../../generated/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RolUsuario[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = this.getRequestWithUser(context);
    const user = request.user;

    if (!user || !user.rol) {
      throw new UnauthorizedException(
        'No se encontró información de sesión válida para verificar el rol.',
      );
    }

    const hasRole = requiredRoles.includes(user.rol);
    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado: se requiere uno de los siguientes roles (${requiredRoles.join(', ')}).`,
      );
    }

    return true;
  }

  private getRequestWithUser(
    context: ExecutionContext,
  ): Request & { user?: JwtPayload } {
    return context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
  }
}