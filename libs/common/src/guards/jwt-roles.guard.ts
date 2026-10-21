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
import { PrismaService } from '@app/database';
import { RolUsuario } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class JwtRolesGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Debe iniciar sesión para acceder a este recurso.');
    }

    const token = authHeader.split(' ')[1];
    try {
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync(token, { secret });

      const usuario = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
      if (!usuario || usuario.estado !== 'ACTIVO') {
        throw new ForbiddenException('Su cuenta de usuario se encuentra desactivada.');
      }

      req.user = {
        id: usuario.id,
        correo: usuario.correo,
        nombresCompletos: usuario.nombresCompletos,
        gradoTitulo: usuario.gradoTitulo,
        iniciales: usuario.iniciales,
        rol: usuario.rol,
      };

      const requiredRoles = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (requiredRoles && !requiredRoles.includes(usuario.rol)) {
        throw new ForbiddenException(
          `Acceso denegado en servidor: Se requiere uno de los siguientes roles: ${requiredRoles.join(', ')}.`,
        );
      }

      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new UnauthorizedException('Token de sesión inválido o expirado.');
    }
  }
}