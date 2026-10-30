// Ruta: src/personas/dto/response/persona.response.ts
import { EstadoDocente, EstadoTesista } from '../../../generated/client';

export interface DocenteInfoResponse {
  id: string;
  gradoAcademico: string;
  estado: EstadoDocente;
  departamentoAcademico: { id: number; nombre: string; };
  escuelaProfesional: { id: number; nombre: string; siglasDocumento: string; };
}

export interface TesistaParticipacionResponse {
  id: string;
  expedienteId: string;
  codigoExpediente: string;
  orden: number;
  estado: EstadoTesista;
}

export interface PersonaResponse {
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  correo: string | null;
  telefono: string | null;
  codigoUniversitario: string | null;
  esDocente: boolean;
  esEstudiante: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
  docente: DocenteInfoResponse | null;
  tesista?: TesistaParticipacionResponse[];
}

export interface DocenteActivoSelectorResponse {
  docenteId: string;
  personaId: string;
  nombreCompleto: string;
  gradoAcademico: string;
  correo: string | null;
  estado: EstadoDocente;
  departamentoAcademico: { id: number; nombre: string; };
  escuelaProfesional: { id: number; nombre: string; siglasDocumento: string; };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedPersonasResponse {
  data: PersonaResponse[];
  meta: PaginationMeta;
}