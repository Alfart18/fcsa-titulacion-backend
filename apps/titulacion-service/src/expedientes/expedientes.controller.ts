// Ruta: src/expedientes/expedientes.controller.ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RolUsuario } from '../generated/client';
import { CambiarEstadoExpedienteDto, CrearExpedienteDto } from './dto/crear-expediente.dto';
import { ListarExpedientesDto } from './dto/listar-expedientes.dto';
import type { ExpedienteDetalleResponse, PaginatedExpedientesResponse, ResolucionExpedienteResponse } from './dto/response/expediente.response';
import { ExpedientesService } from './expedientes.service';

@Controller('expedientes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpedientesController {
  constructor(private readonly expedientesService: ExpedientesService) {}

  @Post()
  @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  crearExpediente(@Body() dto: CrearExpedienteDto, @CurrentUser() user: JwtPayload): Promise<ExpedienteDetalleResponse> {
    return this.expedientesService.crearExpediente(dto, user);
  }

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  listarExpedientes(@Query() query: ListarExpedientesDto): Promise<PaginatedExpedientesResponse> {
    return this.expedientesService.listarExpedientes(query);
  }

  @Get(':id/resoluciones')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  listarResolucionesExpediente(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ResolucionExpedienteResponse[]> {
    return this.expedientesService.listarResolucionesExpediente(id);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  obtenerPorId(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ExpedienteDetalleResponse> {
    return this.expedientesService.obtenerPorId(id);
  }

  @Patch(':id/estado')
  @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIA_ACADEMICA)
  cambiarEstado(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: CambiarEstadoExpedienteDto): Promise<ExpedienteDetalleResponse> {
    return this.expedientesService.cambiarEstado(id, dto);
  }
}