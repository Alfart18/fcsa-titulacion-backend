import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtRolesGuard, Roles } from '@app/common';
import { RolUsuario, SerieNumeracion } from '@app/database';
import { FirmasServiceService } from './firmas-service.service';

@UseGuards(JwtRolesGuard)
@Controller('api/firmas')
export class FirmasServiceController {
  constructor(private readonly firmasService: FirmasServiceService) {}

  // 1. Listar en JSON las resoluciones en estado EMITIDO pendientes de firma
  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.DECANO,
    RolUsuario.SECRETARIA_ACADEMICA,
    RolUsuario.ADMINISTRATIVO,
  )
  @Get('pendientes')
  async listarPendientes(
    @Query('serie') serie?: SerieNumeracion,
    @Query('expedienteId') expedienteId?: string,
  ) {
    return this.firmasService.listarResolucionesPendientesFirma({ serie, expedienteId });
  }

  // 2. Descargar Lote en ZIP de resoluciones pendientes + manifiesto_lote.json
  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.DECANO,
    RolUsuario.SECRETARIA_ACADEMICA,
    RolUsuario.ADMINISTRATIVO,
  )
  @Get('pendientes/zip')
  async descargarZipPendientes(
    @Query('serie') serie: SerieNumeracion | undefined,
    @Query('expedienteId') expedienteId: string | undefined,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { zipBuffer, nombreZip, cantidadArchivos } =
      await this.firmasService.generarZipPendientesFirma(
        { serie, expedienteId },
        req.headers.authorization,
      );

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${nombreZip}"`,
      'Content-Length': zipBuffer.length,
      'X-Total-Resoluciones': String(cantidadArchivos),
    });

    res.end(zipBuffer);
  }

  // 3. Subir 1 o N archivos PDF firmados (Drag-and-Drop múltiple con aislamiento de fallos)
  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.DECANO,
    RolUsuario.SECRETARIA_ACADEMICA,
    RolUsuario.ADMINISTRATIVO,
  )
  @Post('validar-lote')
  @UseInterceptors(
    FilesInterceptor('archivos', 50, {
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024, // 15 MB máximo por PDF
      },
    }),
  )
  async validarLoteFirmados(
    @UploadedFiles() archivos: Array<Express.Multer.File>,
    @Req() req: any,
  ) {
    return this.firmasService.validarLotePdfsFirmados(archivos, req.user);
  }

  // 4. Descargar un PDF firmado ya validado y almacenado en ./storage/firmados/
  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.DECANO,
    RolUsuario.SECRETARIA_ACADEMICA,
    RolUsuario.ADMINISTRATIVO,
  )
  @Get(':resolucionId/pdf-firmado')
  async descargarPdfFirmado(
    @Param('resolucionId', ParseUUIDPipe) resolucionId: string,
    @Res() res: Response,
  ) {
    const { buffer, nombreArchivo, sha256 } =
      await this.firmasService.descargarPdfFirmadoGuardado(resolucionId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nombreArchivo}"`,
      'Content-Length': buffer.length,
      'X-PDF-Firmado-SHA256': sha256,
    });

    res.end(buffer);
  }
}
