// Ruta: apps/identidad-service/src/institucional/institucional.controller.ts
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
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
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto';
import { CambiarDecanoFirmanteDto } from './dto/cambiar-decano-firmante.dto';
import { InstitucionalService } from './institucional.service';

@ApiTags('Institucional')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InstitucionalController {
  constructor(private readonly institucionalService: InstitucionalService) {}

  @Get('institucional/decano-vigente')
  @ApiOperation({ summary: 'Obtener datos del Decano Firmante vigente' })
  async obtenerDecanoVigente() {
    return this.institucionalService.obtenerDecanoFirmanteVigente();
  }

  @Get('configuracion')
  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.DECANO,
    RolUsuario.SECRETARIA_ACADEMICA,
    RolUsuario.ADMINISTRATIVO,
  )
  @ApiOperation({
    summary: 'Obtener configuración institucional y decano firmante actual',
  })
  async obtenerConfiguracion() {
    return this.institucionalService.obtenerConfiguracion();
  }

  @Patch('configuracion')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO)
  @ApiOperation({ summary: 'Actualizar reglamento marco institucional' })
  async actualizarConfiguracion(
    @Body() dto: ActualizarConfiguracionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.institucionalService.actualizarConfiguracion(dto, {
      id: user.id,
      iniciales: user.iniciales,
    });
  }

  @Patch('configuracion/decano-firmante')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA)
  @ApiOperation({ summary: 'Designar nuevo usuario como Decano Firmante' })
  async cambiarDecanoFirmante(
    @Body() dto: CambiarDecanoFirmanteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.institucionalService.cambiarDecanoFirmante(dto, {
      id: user.id,
      iniciales: user.iniciales,
    });
  }
}