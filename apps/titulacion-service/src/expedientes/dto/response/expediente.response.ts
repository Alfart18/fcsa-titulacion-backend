// Ruta: src/expedientes/dto/response/expediente.response.ts
import {
  EstadoDocumentalRes, EstadoExpediente, EstadoTesista, OrigenResolucion, Prisma, SerieNumeracion, SituacionJuridicaRes, TipoResolucion,
} from '../../../generated/client';

export interface PersonaTesistaResumenResponse {
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  codigoUniversitario: string | null;
  correo: string | null;
  telefono: string | null;
}

export interface TesistaExpedienteResponse {
  id: string;
  personaId: string;
  orden: number;
  estado: EstadoTesista;
  aptoResolucionId: string | null;
  tituloResolucionId: string | null;
  fechaSustentacionReal: Date | null;
  notaSustentacion: number | null;
  resultadoSustentacion: string | null;
  persona: PersonaTesistaResumenResponse;
}

export interface ResolucionExpedienteResponse {
  id: string;
  tipo: TipoResolucion;
  serie: SerieNumeracion;
  numeroCorrelativo: number;
  anioNumeracion: number;
  numeroCompleto: string;
  tesistaId: string | null;
  situacionJuridica: SituacionJuridicaRes;
  estadoDocumental: EstadoDocumentalRes;
  origen: OrigenResolucion;
  fechaEmision: Date;
  nombreDecanoSnapshot: string;
  inicialesOperador: string;
  datosEspecificos: Prisma.JsonValue;
  idTramiteControl: string;
  versionPdf: number;
  pdfGeneradoPath: string | null;
  pdfFirmadoPath: string | null;
  fechaConfirmacionFirma: Date | null;
  creadoEn: Date;
}

export interface EscuelaExpedienteResponse {
  id: number;
  nombre: string;
  siglasDocumento: string;
  gradoBachiller: string;
  tituloProfesional: string;
}

export interface ExpedienteResponse {
  id: string;
  codigoExpediente: string;
  escuelaProfesionalId: number;
  estado: EstadoExpediente;
  cantidadTesistas: number;
  pasoActual: number;
  asesorDocenteId: string | null;
  asesorResolucionId: string | null;
  tituloActual: string | null;
  tituloResolucionId: string | null;
  departamentoDictaminantesId: number | null;
  dictaminante1Id: string | null;
  dictaminante2Id: string | null;
  dictaminante3Id: string | null;
  dictaminantesResolucionId: string | null;
  inscripcionResolucionId: string | null;
  libroInscripcionId: string | null;
  fechaHoraResolucionId: string | null;
  creadoPorId: string;
  creadoEn: Date;
  actualizadoEn: Date;
  escuelaProfesional: EscuelaExpedienteResponse;
  tesistas: TesistaExpedienteResponse[];
}

export interface ExpedienteDetalleResponse extends ExpedienteResponse {
  resoluciones: ResolucionExpedienteResponse[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedExpedientesResponse {
  data: ExpedienteResponse[];
  meta: PaginationMeta;
}