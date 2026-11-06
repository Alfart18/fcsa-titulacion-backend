// Ruta: apps/identidad-service/src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '../../generated/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);