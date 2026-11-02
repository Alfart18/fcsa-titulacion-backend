// Ruta: src/resoluciones/resoluciones.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RolUsuario } from '../generated/client';
import { CrearResolucionDto } from './dto/crear-resolucion.dto';
import type { ResolucionResponse } from './dto/response/resolucion.response';
import { ResolucionesService } from './resoluciones.service';

@Controller('resoluciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResolucionesController {
  constructor(private readonly resolucionesService: ResolucionesService) {}

  @Post('emitir')
  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.SECRETARIA_ACADEMICA,
    RolUsuario.ADMINISTRATIVO,
  )
  emitirResolucion(
    @Body() dto: CrearResolucionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ResolucionResponse> {
    return this.resolucionesService.emitirResolucion(dto, user);
  }

  @Get(':id')
  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.DECANO,
    RolUsuario.SECRETARIA_ACADEMICA,
    RolUsuario.ADMINISTRATIVO,
  )
  obtenerPorId(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ResolucionResponse> {
    return this.resolucionesService.obtenerPorId(id);
  }
}