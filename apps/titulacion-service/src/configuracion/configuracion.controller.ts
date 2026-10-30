// Ruta: src/configuracion/configuracion.controller.ts
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { RolUsuario } from '../generated/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ConfiguracionService } from './configuracion.service';
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto';
import { CambiarDecanoFirmanteDto } from './dto/cambiar-decano-firmante.dto';
import type { ConfiguracionCompletaResponse } from './dto/response/configuracion.response';

@Controller('configuracion')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.DECANO,
    RolUsuario.SECRETARIA_ACADEMICA,
    RolUsuario.ADMINISTRATIVO,
  )
  obtenerConfiguracion(): Promise<ConfiguracionCompletaResponse> {
    return this.configuracionService.obtenerConfiguracion();
  }

  @Patch()
  @Roles(RolUsuario.ADMIN)
  actualizarConfiguracion(
    @Body() dto: ActualizarConfiguracionDto,
  ): Promise<ConfiguracionCompletaResponse> {
    return this.configuracionService.actualizarConfiguracion(dto);
  }

  @Patch('decano-firmante')
  @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIA_ACADEMICA)
  cambiarDecanoFirmante(
    @Body() dto: CambiarDecanoFirmanteDto,
  ): Promise<ConfiguracionCompletaResponse> {
    return this.configuracionService.cambiarDecanoFirmante(dto);
  }
}