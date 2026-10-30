// Ruta: src/personas/personas.controller.ts
import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { RolUsuario } from '../generated/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarPersonaDto } from './dto/actualizar-persona.dto';
import { CrearDocenteDto } from './dto/crear-docente.dto';
import { CrearEstudianteDto } from './dto/crear-estudiante.dto';
import { ListarDocentesActivosDto } from './dto/listar-docentes-activos.dto';
import { ListarPersonasDto } from './dto/listar-personas.dto';
import type {
  DocenteActivoSelectorResponse, PaginatedPersonasResponse, PersonaResponse,
} from './dto/response/persona.response';
import { PersonasService } from './personas.service';

@Controller('personas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PersonasController {
  constructor(private readonly personasService: PersonasService) {}

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  listarPersonas(@Query() query: ListarPersonasDto): Promise<PaginatedPersonasResponse> {
    return this.personasService.listarPersonas(query);
  }

  @Get('docentes/activos')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  listarDocentesActivos(@Query() query: ListarDocentesActivosDto): Promise<DocenteActivoSelectorResponse[]> {
    return this.personasService.listarDocentesActivos(query);
  }

  @Post('docentes')
  @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  crearDocente(@Body() dto: CrearDocenteDto): Promise<PersonaResponse> {
    return this.personasService.crearDocente(dto);
  }

  @Post('estudiantes')
  @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  crearEstudiante(@Body() dto: CrearEstudianteDto): Promise<PersonaResponse> {
    return this.personasService.crearEstudiante(dto);
  }

  @Patch('docentes/:id/desactivar')
  @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIA_ACADEMICA)
  desactivarDocente(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<PersonaResponse> {
    return this.personasService.desactivarDocente(id);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  obtenerPorId(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<PersonaResponse> {
    return this.personasService.obtenerPorId(id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  actualizarPersona(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: ActualizarPersonaDto): Promise<PersonaResponse> {
    return this.personasService.actualizarPersona(id, dto);
  }
}