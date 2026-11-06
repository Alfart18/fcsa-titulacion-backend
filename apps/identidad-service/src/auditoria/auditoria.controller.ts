// Ruta: apps/identidad-service/src/auditoria/auditoria.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../generated/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AuditoriaService } from './auditoria.service';
import { FiltroAuditoriaDto } from './dto/filtro-auditoria.dto';

@ApiTags('Auditoría')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get('auditoria/mi-actividad')
  @ApiOperation({
    summary: 'Consultar historial de actividad propio del usuario en sesión',
  })
  async obtenerMiActividad(@CurrentUser() user: JwtPayload) {
    return this.auditoriaService.listarMiActividad(user.id);
  }

  @Get('admin/auditoria')
  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.DECANO,
    RolUsuario.SECRETARIA_ACADEMICA,
  )
  @ApiOperation({
    summary: 'Listar auditoría global de identidad (retrocompatible con frontend)',
  })
  async listarAuditoriaGlobal(
    @Query('usuarioId') usuarioId?: string,
    @Query('accion') accion?: string,
  ) {
    return this.auditoriaService.listarAuditoriaGlobal({ usuarioId, accion });
  }

  @Get('auditoria')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO)
  @ApiOperation({
    summary: 'Consulta avanzada y paginada de registros de auditoría',
  })
  async listarPaginado(@Query() filtros: FiltroAuditoriaDto) {
    return this.auditoriaService.listarRegistrosPaginados(filtros);
  }
}