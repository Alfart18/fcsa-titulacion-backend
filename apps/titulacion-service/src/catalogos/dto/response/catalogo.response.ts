// Ruta: src/catalogos/dto/response/catalogo.response.ts
import { AmbitoCausa } from '../../../generated/client';

export interface CausaResponse {
  id: number;
  ambito: AmbitoCausa;
  descripcion: string;
  requiereDetalleManual: boolean;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface EscuelaCatalogoResponse {
  id: number;
  nombre: string;
  siglasDocumento: string;
  gradoBachiller: string;
  tituloProfesional: string;
  departamentoDefectoId: number;
  activa: boolean;
}

export interface DepartamentoCatalogoResponse {
  id: number;
  nombre: string;
  activo: boolean;
}