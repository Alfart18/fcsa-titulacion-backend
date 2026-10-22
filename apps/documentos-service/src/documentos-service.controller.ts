import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtRolesGuard, Roles } from '@app/common';
import { RolUsuario } from '@prisma/client';
import { DocumentosServiceService } from './documentos-service.service';

@UseGuards(JwtRolesGuard)
@Controller('api/documentos')
export class DocumentosServiceController {
  constructor(private readonly documentosService: DocumentosServiceService) {}

  // Descargar o visualizar en vivo el PDF oficial de cualquier resolución
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Get(':resolucionId/pdf')
  async obtenerPdfResolucion(
    @Param('resolucionId', ParseUUIDPipe) resolucionId: string,
    @Query('descargar') descargar: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, nombreArchivo, selloControl } =
      await this.documentosService.generarPdfResolucion(resolucionId);

    const disposition = descargar === 'true' ? 'attachment' : 'inline';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${nombreArchivo}"`,
      'Content-Length': buffer.length,
      'X-Sello-Control': selloControl,
    });

    res.end(buffer);
  }

  // Verificar por JSON que pdf-lib incrustó correctamente el ID-TRAMITE y HASH en el diccionario interno del PDF
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Get(':resolucionId/verificar-metadatos')
  async verificarMetadatos(
    @Param('resolucionId', ParseUUIDPipe) resolucionId: string,
  ) {
    return this.documentosService.inspeccionarMetadatosPdfGenerado(resolucionId);
  }
}