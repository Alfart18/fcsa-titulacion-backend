// Ruta: apps/documentos-service/src/documentos-service.service.ts
import { Injectable } from '@nestjs/common';
import { IdentidadClient } from './clients/identidad.client';
import { TitulacionClient } from './clients/titulacion.client';
import {
  PdfGeneradoResult,
  PdfGeneratorService,
} from './pdf/pdf-generator.service';

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