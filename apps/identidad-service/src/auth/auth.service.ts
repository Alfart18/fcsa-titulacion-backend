// Ruta: apps/identidad-service/src/auth/auth.service.ts
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { EstadoUsuario } from '../generated/client';
import { IdentidadPrismaService } from '../prisma/identidad-prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: IdentidadPrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    if (usuario.estado === EstadoUsuario.DESACTIVADO) {
      throw new ForbiddenException(
        'Su cuenta se encuentra DESACTIVADA. Comuníquese con el Decanato de la FCSa.',
      );
    }

    const passwordValido = await bcrypt.compare(
      dto.password,
      usuario.passwordHash,
    );
    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    const payload = {
      sub: usuario.id,
      rol: usuario.rol,
      iniciales: usuario.iniciales,
      nombresCompletos: usuario.nombresCompletos,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      usuario: {
        id: usuario.id,
        nombresCompletos: `${usuario.gradoTitulo} ${usuario.nombresCompletos}`,
        correo: usuario.correo,
        iniciales: usuario.iniciales,
        rol: usuario.rol,
        esDecanoFirmante: usuario.esDecanoFirmante,
      },
    };
  }
}