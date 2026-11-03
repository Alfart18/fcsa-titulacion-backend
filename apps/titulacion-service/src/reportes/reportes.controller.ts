// Ruta: src/reportes/reportes.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '../generated/client';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN, RolUsuario.DECANO)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('resumen')
  async obtenerResumen() { return this.reportesService.obtenerResumenGeneral(); }

  @Get('expedientes-por-estado')
  async obtenerExpedientesPorEstado() { return this.reportesService.obtenerExpedientesPorEstado(); }

  @Get('expedientes-por-escuela')
  async obtenerExpedientesPorEscuela() { return this.reportesService.obtenerExpedientesPorEscuela(); }

  @Get('resoluciones-por-mes')
  async obtenerResolucionesPorMes() { return this.reportesService.obtenerResolucionesPorMes(); }

  @Get('titulos-por-escuela')
  async obtenerTitulosPorEscuela() { return this.reportesService.obtenerTitulosPorEscuelaAnioActual(); }
}