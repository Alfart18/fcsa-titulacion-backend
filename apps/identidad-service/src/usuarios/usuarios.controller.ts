// Ruta: apps/identidad-service/src/usuarios/usuarios.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('admin/usuarios')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO)
  @ApiOperation({ summary: 'Listar todos los usuarios registrados' })
  async listarUsuarios() {
    return this.usuariosService.listarUsuarios();
  }

  @Post('admin/usuarios')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO)
  @ApiOperation({ summary: 'Crear un nuevo usuario institucional' })
  async crearUsuario(
    @Body() dto: CrearUsuarioDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usuariosService.crearUsuario(dto, {
      id: user.id,
      iniciales: user.iniciales,
    });
  }

  @Patch('admin/usuarios/:id')
  @Roles(RolUsuario.ADMIN, RolUsuario.DECANO)
  @ApiOperation({
    summary: 'Actualizar estado (ACTIVO/DESACTIVADO) o condición de Decano Firmante',
  })
  async actualizarUsuario(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usuariosService.actualizarUsuario(id, dto, {
      id: user.id,
      iniciales: user.iniciales,
    });
  }

  @Get('internal/usuarios/:id')
  @Roles(
    RolUsuario.ADMIN,
    RolUsuario.DECANO,
    RolUsuario.SECRETARIA_ACADEMICA,
    RolUsuario.ADMINISTRATIVO,
  )
  @ApiOperation({
    summary: 'Endpoint interno para consulta de usuario por UUID desde otros microservicios',
  })
  async obtenerUsuarioInterno(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.obtenerUsuarioInternoPorId(id);
  }
}