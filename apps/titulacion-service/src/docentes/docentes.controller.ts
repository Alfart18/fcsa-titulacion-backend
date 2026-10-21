import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DocentesService } from './docentes.service';
import { JwtRolesGuard, Roles } from '@app/common';
import { EstadoDocente, RolUsuario } from '@prisma/client';
import { CrearDocenteDto } from './dto/crear-docente.dto';
import { ActualizarDocenteDto } from './dto/actualizar-docente.dto';

@UseGuards(JwtRolesGuard)
@Controller('api')
export class DocentesController {
  constructor(private readonly docentesService: DocentesService) {}

  // Lectura permitida para los 3 roles (DECANO, SECRETARIA_ACADEMICA, ADMINISTRATIVO)
  @Get('catalogos/academicos')
  async obtenerCatalogosAcademicos() {
    return this.docentesService.listarCatalogosAcademicos();
  }

  // Listado general del catálogo (permite filtrar activos e inactivos)
  @Get('docentes')
  async listarDocentes(
    @Query('q') q?: string,
    @Query('departamentoId') departamentoId?: string,
    @Query('escuelaId') escuelaId?: string,
    @Query('estado') estado?: EstadoDocente,
  ) {
    return this.docentesService.listarDocentes({
      q,
      departamentoId: departamentoId ? Number(departamentoId) : undefined,
      escuelaId: escuelaId ? Number(escuelaId) : undefined,
      estado,
    });
  }

  // Buscador inteligente con Embudo de 3 Niveles para armar Resoluciones (Solo devuelve ACTIVOS)
  @Get('docentes/elegibles')
  async buscarElegiblesEmbudo(
    @Query('escuelaId', ParseIntPipe) escuelaId: number,
    @Query('incluirOtrosDepartamentos') incluirOtrosDepartamentos?: string,
    @Query('excluirIds') excluirIds?: string,
    @Query('q') q?: string,
  ) {
    const listaExcluidos = excluirIds
      ? excluirIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    return this.docentesService.buscarDocentesElegiblesEmbudo({
      escuelaProfesionalId: escuelaId,
      incluirOtrosDepartamentos: incluirOtrosDepartamentos !== 'false',
      excluirDocentesIds: listaExcluidos,
      q,
    });
  }

  // Escritura restringida exclusivamente a DECANO y SECRETARIA_ACADEMICA
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA)
  @Post('docentes')
  async crearDocente(@Body() dto: CrearDocenteDto, @Req() req: any) {
    return this.docentesService.crearDocente(dto, req.user);
  }

  // Edición de datos, ascensos de grado (Mg. -> Dr.) e inactivación preventiva
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA)
  @Patch('docentes/:id')
  async actualizarDocente(
    @Param('id') id: string,
    @Body() dto: ActualizarDocenteDto,
    @Req() req: any,
  ) {
    return this.docentesService.actualizarDocente(id, dto, req.user);
  }
}