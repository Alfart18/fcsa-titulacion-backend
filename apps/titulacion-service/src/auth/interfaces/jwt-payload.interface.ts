// Ruta: src/auth/interfaces/jwt-payload.interface.ts
import { RolUsuario } from '../../generated/client';

export interface JwtPayload {
  sub: string;
  rol: RolUsuario;
  iniciales: string;
  iat?: number;
  exp?: number;
}