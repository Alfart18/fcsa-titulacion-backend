// Ruta: apps/documentos-service/src/documentos-service.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Roles } from './auth/decorators/roles.decorator';
import { RolUsuario } from './auth/enums/rol-usuario.enum';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import type { JwtPayload } from './auth/interfaces/jwt-payload.interface';
import {
  DocumentosServiceService,
  PrevisualizarPdfDto,
} from './documentos-service.service';

@ApiTags('Documentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documentos')
export class DocumentosServiceController {
  constructor(private readonly documentosService: DocumentosServiceService) {}

  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.DECANO,
    RolUsuario.SECRETARIA_ACADEMICA,
    RolUsuario.ADMINISTRATIVO,
  )
  @Post('previsualizar-pdf')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Generar una vista previa en vivo en PDF de una resolución borrador sin persistir',
  })
  @ApiBody({ type: PrevisualizarPdfDto })
  async previsualizarPdf(
    @Body() payload: PrevisualizarPdfDto,
    @Req() req: Request & { user?: JwtPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Token de autorización no proporcionado.');
    }

    const { buffer, selloControl } =
      await this.documentosService.generarPdfPrevisualizacion(
        payload,
        req.user,
        authHeader,
      );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="VISTA_PREVIA.pdf"',
      'Content-Length': buffer.length,
      'X-Sello-Control': selloControl,
    });

    return new StreamableFile(buffer);
  }

  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.DECANO,
    RolUsuario.SECRETARIA_ACADEMICA,
    RolUsuario.ADMINISTRATIVO,
  )
  @Get(':resolucionId/pdf')
  @ApiOperation({
    summary: 'Descargar o visualizar en vivo el PDF oficial de una resolución',
  })
  @ApiQuery({ name: 'descargar', required: false, type: String })
  async obtenerPdfResolucion(
    @Param('resolucionId', ParseUUIDPipe) resolucionId: string,
    @Query('descargar') descargar: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Token de autorización no proporcionado.');
    }

    const { buffer, nombreArchivo, selloControl } =
      await this.documentosService.generarPdfResolucion(
        resolucionId,
        authHeader,
      );

    const disposition = descargar === 'true' ? 'attachment' : 'inline';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${nombreArchivo}"`,
      'Content-Length': buffer.length,
      'X-Sello-Control': selloControl,
    });

    return new StreamableFile(buffer);
  }

  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.DECANO,
    RolUsuario.SECRETARIA_ACADEMICA,
    RolUsuario.ADMINISTRATIVO,
  )
  @Get(':resolucionId/verificar-metadatos')
  @ApiOperation({
    summary:
      'Verificar en JSON que pdf-lib incrustó correctamente el ID-TRAMITE y HASH en el diccionario PDF',
  })
  async verificarMetadatos(
    @Param('resolucionId', ParseUUIDPipe) resolucionId: string,
    @Req() req: Request,
  ) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Token de autorización no proporcionado.');
    }

    return this.documentosService.inspeccionarMetadatosPdfGenerado(
      resolucionId,
      authHeader,
    );
  }
}