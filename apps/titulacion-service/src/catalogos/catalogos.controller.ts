// Ruta: src/catalogos/catalogos.controller.ts
import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { RolUsuario } from '../generated/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CatalogosService } from './catalogos.service';
import { ActualizarCausaDto } from './dto/actualizar-causa.dto';
import { CrearCausaDto } from './dto/crear-causa.dto';
import { ListarCausasDto } from './dto/listar-causas.dto';
import type {
  CausaResponse, DepartamentoCatalogoResponse, EscuelaCatalogoResponse,
} from './dto/response/catalogo.response';

@Controller('catalogos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  @Get('causas')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  listarCausas(@Query() query: ListarCausasDto): Promise<CausaResponse[]> {
    return this.catalogosService.listarCausas(query);
  }

  @Post('causas')
  @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIA_ACADEMICA)
  crearCausa(@Body() dto: CrearCausaDto): Promise<CausaResponse> {
    return this.catalogosService.crearCausa(dto);
  }

  @Patch('causas/:id')
  @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIA_ACADEMICA)
  actualizarCausa(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarCausaDto): Promise<CausaResponse> {
    return this.catalogosService.actualizarCausa(id, dto);
  }

  @Get('escuelas')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  listarEscuelas(): Promise<EscuelaCatalogoResponse[]> {
    return this.catalogosService.listarEscuelas();
  }

  @Get('departamentos')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  listarDepartamentos(): Promise<DepartamentoCatalogoResponse[]> {
    return this.catalogosService.listarDepartamentos();
  }
}