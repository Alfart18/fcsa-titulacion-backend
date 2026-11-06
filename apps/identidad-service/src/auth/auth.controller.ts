// Ruta: apps/identidad-service/src/auth/auth.controller.ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Iniciar sesión y obtener token JWT' })
  @ApiResponse({ status: 201, description: 'Autenticación exitosa.' })
  @ApiResponse({ status: 401, description: 'Credenciales incorrectas.' })
  @ApiResponse({ status: 403, description: 'Cuenta desactivada.' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos de inicio de sesión.' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado (retrocompatible)' })
  obtenerPerfil(@CurrentUser() user: JwtPayload): JwtPayload {
    return user;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener payload de sesión actual' })
  getMe(@CurrentUser() user: JwtPayload): JwtPayload {
    return user;
  }
}