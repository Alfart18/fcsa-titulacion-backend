// Ruta: apps/identidad-service/src/usuarios/dto/actualizar-usuario.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { EstadoUsuario } from '../../generated/client';

export class ActualizarUsuarioDto {
  @ApiPropertyOptional({
    enum: EstadoUsuario,
    example: EstadoUsuario.ACTIVO,
  })
  @IsOptional()
  @IsEnum(EstadoUsuario, {
    message: 'El estado debe ser ACTIVO o DESACTIVADO.',
  })
  estado?: EstadoUsuario;

  @ApiPropertyOptional({
    example: true,
    description: 'Designar o retirar condición de Decano Firmante',
  })
  @IsOptional()
  @IsBoolean({ message: 'esDecanoFirmante debe ser un valor booleano.' })
  esDecanoFirmante?: boolean;
}