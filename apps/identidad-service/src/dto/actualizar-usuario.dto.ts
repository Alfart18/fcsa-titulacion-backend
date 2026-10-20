import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { EstadoUsuario } from '@prisma/client';

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsEnum(EstadoUsuario, { message: 'El estado debe ser ACTIVO o DESACTIVADO.' })
  estado?: EstadoUsuario;

  @IsOptional()
  @IsBoolean({ message: 'esDecanoFirmante debe ser un valor booleano.' })
  esDecanoFirmante?: boolean;
}