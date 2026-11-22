// Ruta: apps/documentos-service/src/documentos-service.service.ts
import { Injectable } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import type { JwtPayload } from './auth/interfaces/jwt-payload.interface';
import {
  type ConfiguracionInstitucionalDto,
  IdentidadClient,
} from './clients/identidad.client';
import {
  type ResolucionRemotaDto,
  TitulacionClient,
} from './clients/titulacion.client';
import {
  type PdfGeneradoResult,
  PdfGeneratorService,
} from './pdf/pdf-generator.service';
import {
  SerieNumeracion,
  TipoResolucion,
} from './templates/resolucion-templates.service';

export class PrevisualizarPdfDto {
  @ApiProperty({ enum: TipoResolucion })
  @IsEnum(TipoResolucion)
  tipo: TipoResolucion;

  @ApiPropertyOptional({ enum: SerieNumeracion })
  @IsOptional()
  @IsEnum(SerieNumeracion)
  serie?: SerieNumeracion;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  expedienteId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  codigoExpediente?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  fechaEmision?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  datosEspecificos?: Record<string, any>;
}

const DEFAULT_CONFIG_INSTITUCIONAL: ConfiguracionInstitucionalDto = {
  id: 1,
  facultad: 'Facultad de Ciencias de la Salud',
  universidad: 'Universidad Andina del Cusco',
  ciudad: 'Cusco',
  siglasFacultad: 'FCSa',
  siglasUniversidad: 'UAC',
  reglamentoMarco: 'Resolución N.º 513-CU-2024-UAC',
};

@Injectable()
export class DocumentosServiceService {
  constructor(
    private readonly titulacionClient: TitulacionClient,
    private readonly identidadClient: IdentidadClient,
    private readonly pdfGeneratorService: PdfGeneratorService,
  ) {}

  async generarPdfResolucion(
    resolucionId: string,
    authHeader?: string,
  ): Promise<PdfGeneradoResult> {
    const [resolucion, configuracion, decanoVigente] = await Promise.all([
      this.titulacionClient.obtenerResolucionPorId(resolucionId, authHeader),
      this.identidadClient.obtenerConfiguracion(authHeader),
      this.identidadClient.obtenerDecanoVigente(authHeader),
    ]);

    return this.pdfGeneratorService.generarPdf({
      resolucion,
      configuracion,
      nombreDecanoVigente: decanoVigente?.nombreCompletoFormateado,
      inicialesDecanoVigente: decanoVigente?.iniciales,
    });
  }

  async generarPdfPrevisualizacion(
    payload: PrevisualizarPdfDto,
    user?: JwtPayload,
    authHeader?: string,
  ): Promise<PdfGeneradoResult> {
    const [configuracion, decanoVigente] = await Promise.all([
      this.identidadClient
        .obtenerConfiguracion(authHeader)
        .catch(() => DEFAULT_CONFIG_INSTITUCIONAL),
      this.identidadClient
        .obtenerDecanoVigente(authHeader)
        .catch(() => null),
    ]);

    const anioActual = new Date().getFullYear();
    const serie: SerieNumeracion =
      payload.serie ??
      (payload.tipo === TipoResolucion.APTO ||
      payload.tipo === TipoResolucion.TITULO
        ? SerieNumeracion.CF
        : SerieNumeracion.ORD);

    const resolucion: ResolucionRemotaDto = {
      id: 'preview-borrador',
      expedienteId: payload.expedienteId ?? null,
      tipo: payload.tipo,
      serie,
      numeroCorrelativo: 0,
      anioNumeracion: anioActual,
      numeroCompleto: `RES-${serie}-${anioActual}-XXXX (VISTA PREVIA)`,
      fechaEmision: payload.fechaEmision || new Date().toISOString(),
      nombreDecanoSnapshot:
        decanoVigente?.nombreCompletoFormateado || 'DECANO FCSa-UAC',
      inicialesOperador: (user?.iniciales || 'op').toLowerCase(),
      datosEspecificos: payload.datosEspecificos || {},
      idTramiteControl: 'VISTA-PREVIA-SIN-EMITIR',
      versionPdf: 1,
      hashVersionGenerado: 'BORRADOR0000',
      expediente: payload.codigoExpediente
        ? { codigoExpediente: payload.codigoExpediente }
        : null,
    };

    return this.pdfGeneratorService.generarPdf({
      resolucion,
      configuracion,
      nombreDecanoVigente: decanoVigente?.nombreCompletoFormateado,
      inicialesDecanoVigente: decanoVigente?.iniciales,
    });
  }

  async inspeccionarMetadatosPdfGenerado(
    resolucionId: string,
    authHeader?: string,
  ) {
    const { buffer, nombreArchivo, selloControl } =
      await this.generarPdfResolucion(resolucionId, authHeader);

    return this.pdfGeneratorService.extraerMetadatosBuffer(
      buffer,
      nombreArchivo,
      selloControl,
    );
  }
}