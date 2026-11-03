// Ruta: src/auditoria/auditoria.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { FiltroAuditoriaDto } from './dto/filtro-auditoria.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '../generated/client';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  async listar(@Query() filtros: FiltroAuditoriaDto) {
    return this.auditoriaService.listarRegistros(filtros);
  }
}