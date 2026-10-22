import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ExpedientesService } from './expedientes.service';
import { JwtRolesGuard, Roles } from '@app/common';
import { EstadoExpediente, RolUsuario } from '@prisma/client';
import { CrearExpedienteDto } from './dto/crear-expediente.dto';

@UseGuards(JwtRolesGuard)
@Controller('api/expedientes')
export class ExpedientesController {
  constructor(private readonly expedientesService: ExpedientesService) {}

  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Post()
  async crearExpediente(@Body() dto: CrearExpedienteDto, @Req() req: any) {
    return this.expedientesService.crearExpediente(dto, req.user);
  }

  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Get()
  async listarExpedientes(
    @Query('q') q?: string,
    @Query('escuelaId') escuelaId?: string,
    @Query('estado') estado?: EstadoExpediente,
  ) {
    return this.expedientesService.listarExpedientes({
      q,
      escuelaId: escuelaId ? Number(escuelaId) : undefined,
      estado,
    });
  }

  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Get(':id')
  async obtenerFichaExpediente(@Param('id', ParseUUIDPipe) id: string) {
    return this.expedientesService.obtenerFichaExpediente(id);
  }
}