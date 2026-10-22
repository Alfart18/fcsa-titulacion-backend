import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ResolucionesService } from './resoluciones.service';
import { JwtRolesGuard, Roles } from '@app/common';
import { AmbitoCausa, CategoriaNumeracion, RolUsuario, SerieNumeracion } from '@prisma/client';
import { EmitirPasoFlujoBodyDto } from './dto/emitir-paso-flujo.dto';
import {
  ActualizarCatalogoCausaDto,
  CrearCatalogoCausaDto,
  EmitirCambioAsesorDto,
  EmitirCambioDictaminanteDto,
  EmitirCambioTituloDto,
  EmitirDejarSinEfectoDto,
  EmitirDesistimientoDto,
  RegistrarDocumentoExternoDto,
} from './dto/complementarias.dto';

@UseGuards(JwtRolesGuard)
@Controller('api')
export class ResolucionesController {
  constructor(private readonly resolucionesService: ResolucionesService) {}

  // ==========================================================================
  // 1. FLUJO REGULAR DE LOS 7 PASOS SECUENCIALES
  // ==========================================================================
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Post('expedientes/:id/pasos/:tipo')
  async emitirPasoFlujo(
    @Param('id', ParseUUIDPipe) expedienteId: string,
    @Param('tipo') tipo: string,
    @Body() body: EmitirPasoFlujoBodyDto,
    @Req() req: any,
  ) {
    return this.resolucionesService.emitirPasoFlujoRegular(expedienteId, tipo, body, req.user);
  }

  // ==========================================================================
  // 2. RESOLUCIONES COMPLEMENTARIAS Y EXCEPCIONES
  // ==========================================================================

  // 2.1. Cambio de Asesor (Serie ORD)
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Post('expedientes/:id/complementarias/cambio-asesor')
  async emitirCambioAsesor(
    @Param('id', ParseUUIDPipe) expedienteId: string,
    @Body() dto: EmitirCambioAsesorDto,
    @Req() req: any,
  ) {
    return this.resolucionesService.emitirCambioAsesor(expedienteId, dto, req.user);
  }

  // 2.2. Cambio de Título - DICE / DEBE DECIR (Serie ORD)
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Post('expedientes/:id/complementarias/cambio-titulo')
  async emitirCambioTitulo(
    @Param('id', ParseUUIDPipe) expedienteId: string,
    @Body() dto: EmitirCambioTituloDto,
    @Req() req: any,
  ) {
    return this.resolucionesService.emitirCambioTitulo(expedienteId, dto, req.user);
  }

  // 2.3. Cambio de Dictaminante (Serie ORD - Bloqueado si Paso 6 está vigente)
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Post('expedientes/:id/complementarias/cambio-dictaminante')
  async emitirCambioDictaminante(
    @Param('id', ParseUUIDPipe) expedienteId: string,
    @Body() dto: EmitirCambioDictaminanteDto,
    @Req() req: any,
  ) {
    return this.resolucionesService.emitirCambioDictaminante(expedienteId, dto, req.user);
  }

  // 2.4. Desistimiento de Tesista (Serie ORD - Solo 2 tesistas activos y antes del Paso 6)
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Post('expedientes/:id/complementarias/desistimiento')
  async emitirDesistimiento(
    @Param('id', ParseUUIDPipe) expedienteId: string,
    @Body() dto: EmitirDesistimientoDto,
    @Req() req: any,
  ) {
    return this.resolucionesService.emitirDesistimiento(expedienteId, dto, req.user);
  }

  // 2.5. Dejar Sin Efecto - DSE (Serie ORD o CF + Recálculo de punteros o Reinicio Integral)
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Post('expedientes/:id/complementarias/dse')
  async emitirDejarSinEfecto(
    @Param('id', ParseUUIDPipe) expedienteId: string,
    @Body() dto: EmitirDejarSinEfectoDto,
    @Req() req: any,
  ) {
    return this.resolucionesService.emitirDejarSinEfecto(expedienteId, dto, req.user);
  }

  // ==========================================================================
  // 3. LIBRO DE NUMERACIÓN (DOCUMENTOS EXTERNOS) Y LIBRO DE INSCRIPCIÓN
  // ==========================================================================

  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Post('numeracion/documentos-externos')
  async registrarDocumentoExterno(
    @Body() dto: RegistrarDocumentoExternoDto,
    @Req() req: any,
  ) {
    return this.resolucionesService.registrarDocumentoExterno(dto, req.user);
  }

  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Get('numeracion')
  async listarLibroNumeracion(
    @Query('serie') serie?: SerieNumeracion,
    @Query('anio') anio?: string,
    @Query('categoria') categoria?: CategoriaNumeracion,
    @Query('q') q?: string,
  ) {
    return this.resolucionesService.listarLibroNumeracion({
      serie,
      anio: anio ? Number(anio) : undefined,
      categoria,
      q,
    });
  }

  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Get('libro-inscripcion')
  async listarLibroInscripcion(
    @Query('escuelaId') escuelaId?: string,
    @Query('anio') anio?: string,
    @Query('q') q?: string,
  ) {
    return this.resolucionesService.listarLibroInscripcion({
      escuelaId: escuelaId ? Number(escuelaId) : undefined,
      anio: anio ? Number(anio) : undefined,
      q,
    });
  }

  // ==========================================================================
  // 4. CATÁLOGO DE CAUSAS Y TIPOS (Lectura: Todos | Escritura: DECANO y SECRETARIA)
  // ==========================================================================

  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Get('catalogos/causas')
  async listarCatalogoCausas(
    @Query('ambito') ambito?: AmbitoCausa,
    @Query('incluirInactivos') incluirInactivos?: string,
  ) {
    return this.resolucionesService.listarCatalogoCausas(
      ambito,
      incluirInactivos === 'true',
    );
  }

  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA)
  @Post('catalogos/causas')
  async crearCatalogoCausa(@Body() dto: CrearCatalogoCausaDto, @Req() req: any) {
    return this.resolucionesService.crearCatalogoCausa(dto, req.user);
  }

  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA)
  @Patch('catalogos/causas/:id')
  async actualizarCatalogoCausa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCatalogoCausaDto,
    @Req() req: any,
  ) {
    return this.resolucionesService.actualizarCatalogoCausa(id, dto, req.user);
  }

  // ==========================================================================
  // 5. CONFIRMACIÓN DE FIRMA Y CORRECCIÓN DE BORRADOR EN ESTADO EMITIDO
  // ==========================================================================

  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Patch('resoluciones/:id/confirmar-firma')
  async confirmarFirma(
    @Param('id', ParseUUIDPipe) resolucionId: string,
    @Req() req: any,
  ) {
    return this.resolucionesService.confirmarFirmaResolucion(resolucionId, req.user);
  }

  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Patch('resoluciones/:id/corregir-borrador-emitido')
  async corregirBorradorEmitido(
    @Param('id', ParseUUIDPipe) resolucionId: string,
    @Body() body: EmitirPasoFlujoBodyDto,
    @Req() req: any,
  ) {
    return this.resolucionesService.corregirBorradorEmitido(resolucionId, body, req.user);
  }
}