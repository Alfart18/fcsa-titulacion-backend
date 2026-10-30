// Ruta: src/configuracion/dto/response/configuracion.response.ts
import { EstadoUsuario, RolUsuario } from '../../../generated/client';

export interface DecanoFirmanteResponse {
  id: string;
  nombresCompletos: string;
  gradoTitulo: string;
  correo: string;
  iniciales: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
  esDecanoFirmante: boolean;
}

export interface ConfiguracionInstitucionalResponse {
  id: number;
  facultad: string;
  universidad: string;
  ciudad: string;
  siglasFacultad: string;
  siglasUniversidad: string;
  reglamentoMarco: string;
  actualizadoEn: Date;
}

export interface ConfiguracionCompletaResponse {
  institucional: ConfiguracionInstitucionalResponse;
  decanoFirmante: DecanoFirmanteResponse | null;
}