// Ruta: src/plantillas/plantillas.controller.ts
import {
  Body, Controller, Get, Param, ParseEnumPipe, ParseIntPipe, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { PlantillasService } from './plantillas.service';
import { ActualizarPlantillaDto, PrevisualizarPlantillaDto } from './dto/plantillas.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario, TipoResolucion } from '../generated/client';

@Controller('plantillas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlantillasController {
  constructor(private readonly plantillasService: PlantillasService) {}

  @Get()
  async listarTodas() {
    return this.plantillasService.listarTodas();
  }

  @Get(':tipo')
  async obtenerPorTipo(@Param('tipo', new ParseEnumPipe(TipoResolucion)) tipo: TipoResolucion) {
    return this.plantillasService.obtenerPorTipo(tipo);
  }

  @Put(':tipo')
  @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIA_ACADEMICA)
  async actualizarPlantilla(
    @Param('tipo', new ParseEnumPipe(TipoResolucion)) tipo: TipoResolucion,
    @Body() dto: ActualizarPlantillaDto,
    @Req() req: any,
  ) {
    return this.plantillasService.actualizarPlantilla(tipo, dto, {
      id: req.user.sub, // <-- CORREGIDO
      iniciales: req.user.iniciales ?? 'OP',
    });
  }

  @Post(':tipo/restaurar/:version')
  @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIA_ACADEMICA)
  async restaurarVersion(
    @Param('tipo', new ParseEnumPipe(TipoResolucion)) tipo: TipoResolucion,
    @Param('version', ParseIntPipe) version: number,
    @Req() req: any,
  ) {
    return this.plantillasService.restaurarVersion(tipo, version, {
      id: req.user.sub, // <-- CORREGIDO
      iniciales: req.user.iniciales ?? 'OP',
    });
  }

  @Post(':tipo/previsualizar')
  async previsualizar(
    @Param('tipo', new ParseEnumPipe(TipoResolucion)) tipo: TipoResolucion,
    @Body() dto: PrevisualizarPlantillaDto,
  ) {
    return this.plantillasService.previsualizarPlantilla(tipo, dto);
  }
}