// Ruta: src/resoluciones/dto/response/resolucion.response.ts
import {
  EstadoDocumentalRes,
  EstadoExpediente,
  OrigenResolucion,
  Prisma,
  SerieNumeracion,
  SituacionJuridicaRes,
  TipoResolucion,
} from '../../../generated/client';

export interface ExpedienteResumenResolucionResponse {
  id: string;
  codigoExpediente: string;
  estado: EstadoExpediente;
  pasoActual: number;
  tituloActual: string | null;
  asesorResolucionId: string | null;
  dictaminantesResolucionId: string | null;
  inscripcionResolucionId: string | null;
  fechaHoraResolucionId: string | null;
  tituloResolucionId: string | null;
}

export interface ResolucionResponse {
  id: string;
  expedienteId: string;
  tipo: TipoResolucion;
  serie: SerieNumeracion;
  numeroCorrelativo: number;
  anioNumeracion: number;
  numeroCompleto: string;
  tesistaId: string | null;
  resolucionAntecedenteId: string | null;
  situacionJuridica: SituacionJuridicaRes;
  estadoDocumental: EstadoDocumentalRes;
  origen: OrigenResolucion;
  fechaEmision: Date;
  nombreDecanoSnapshot: string;
  inicialesOperador: string;
  datosEspecificos: Prisma.JsonValue;
  idTramiteControl: string;
  versionPdf: number;
  hashVersionGenerado: string;
  pdfGeneradoPath: string | null;
  pdfFirmadoPath: string | null;
  pdfFirmadoSha256: string | null;
  fechaConfirmacionFirma: Date | null;
  usuarioEmisorId: string;
  creadoEn: Date;
  actualizadoEn: Date;
  expediente?: ExpedienteResumenResolucionResponse;
}