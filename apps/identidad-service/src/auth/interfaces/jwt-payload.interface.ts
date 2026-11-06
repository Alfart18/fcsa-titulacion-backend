// Ruta: apps/identidad-service/src/auth/interfaces/jwt-payload.interface.ts
import { RolUsuario } from '../../generated/client';

export interface JwtPayload {
  id: string;
  sub: string;
  rol: RolUsuario;
  iniciales: string;
  nombresCompletos?: string;
  iat?: number;
  exp?: number;
}