// Ruta: src/libros/libros.controller.ts
import {
  Body, Controller, Get, ParseIntPipe, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { LibrosService } from './libros.service';
import {
  FiltroLibroInscripcionDto, FiltroLibroNumeracionDto, FiltroLibroTituloDto, ReservarNumeracionExternaDto,
} from './dto/libros.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '../generated/client';

@Controller('libros')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LibrosController {
  constructor(private readonly librosService: LibrosService) {}

  @Get('contadores')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  async obtenerContadores(
    @Query('anio', new ParseIntPipe({ optional: true })) anio?: number,
  ) {
    return this.librosService.obtenerResumenContadores(anio);
  }

  @Get('numeracion')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  async listarNumeracion(@Query() filtros: FiltroLibroNumeracionDto) {
    return this.librosService.listarLibroNumeracion(filtros);
  }

  @Post('numeracion/externo')
  @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  async reservarNumeracionExterna(
    @Body() dto: ReservarNumeracionExternaDto,
    @Req() req: any,
  ) {
    return this.librosService.reservarNumeracionExterna(dto, {
      id: req.user.sub, // <-- CORREGIDO (antes decía req.user.id)
      iniciales: req.user.iniciales ?? 'OP',
    });
  }

  @Get('inscripcion')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  async listarInscripcion(@Query() filtros: FiltroLibroInscripcionDto) {
    return this.librosService.listarLibroInscripcion(filtros);
  }

  @Get('titulos')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  async listarTitulos(@Query() filtros: FiltroLibroTituloDto) {
    return this.librosService.listarLibroTitulo(filtros);
  }
}