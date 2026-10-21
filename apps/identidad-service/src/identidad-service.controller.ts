import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IdentidadServiceService } from './identidad-service.service';
import { JwtRolesGuard, Roles } from '@app/common';
import { RolUsuario } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';

@Controller('api')
export class IdentidadServiceController {
  constructor(private readonly identidadService: IdentidadServiceService) {}

  @Post('auth/login')
  async login(@Body() dto: LoginDto) {
    return this.identidadService.login(dto);
  }

  @UseGuards(JwtRolesGuard)
  @Get('auth/perfil')
  async obtenerPerfil(@Req() req: any) {
    return req.user;
  }

  @UseGuards(JwtRolesGuard)
  @Get('institucional/decano-vigente')
  async obtenerDecanoVigente() {
    return this.identidadService.obtenerDecanoFirmanteVigente();
  }

  // Actividad propia: filtra estrictamente por el ID del token en sesión
  @UseGuards(JwtRolesGuard)
  @Get('auditoria/mi-actividad')
  async obtenerMiActividad(@Req() req: any) {
    return this.identidadService.listarMiActividad(req.user.id);
  }

  // Auditoría global: exclusivo para DECANO y SECRETARIA_ACADEMICA
  @UseGuards(JwtRolesGuard)
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA)
  @Get('admin/auditoria')
  async listarAuditoriaGlobal(
    @Query('usuarioId') usuarioId?: string,
    @Query('accion') accion?: string,
  ) {
    return this.identidadService.listarAuditoriaGlobal({ usuarioId, accion });
  }

  // Gestión de usuarios: exclusivo para DECANO
  @UseGuards(JwtRolesGuard)
  @Roles(RolUsuario.DECANO)
  @Get('admin/usuarios')
  async listarUsuarios() {
    return this.identidadService.listarUsuarios();
  }

  @UseGuards(JwtRolesGuard)
  @Roles(RolUsuario.DECANO)
  @Post('admin/usuarios')
  async crearUsuario(@Body() dto: CrearUsuarioDto, @Req() req: any) {
    return this.identidadService.crearUsuario(dto, req.user);
  }

  @UseGuards(JwtRolesGuard)
  @Roles(RolUsuario.DECANO)
  @Patch('admin/usuarios/:id')
  async actualizarUsuario(
    @Param('id') id: string,
    @Body() dto: ActualizarUsuarioDto,
    @Req() req: any,
  ) {
    return this.identidadService.actualizarUsuario(id, dto, req.user);
  }
}