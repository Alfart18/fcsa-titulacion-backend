import { RolUsuario } from '../enums/rol-usuario.enum';

export interface JwtPayload {
  id: string;
  sub: string;
  rol: RolUsuario;
  iniciales: string;
  nombresCompletos?: string;
  iat?: number;
  exp?: number;
}