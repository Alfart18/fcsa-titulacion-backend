// Ruta: apps/identidad-service/src/usuarios/dto/actualizar-usuario.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EstadoUsuario, RolUsuario } from '../../generated/client';

export class ActualizarUsuarioDto {
  @ApiPropertyOptional({
    example: 'JUAN CARLOS PÉREZ GÓMEZ',
    description: 'Nombres y apellidos completos del usuario',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Los nombres completos no pueden quedar vacíos.' })
  @MaxLength(180)
  nombresCompletos?: string;

  @ApiPropertyOptional({
    example: 'Dr.',
    description: 'Grado o título abreviado (Dr., Mg., Lic., Ing.)',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El grado o título no puede quedar vacío.' })
  @MaxLength(50)
  gradoTitulo?: string;

  @ApiPropertyOptional({
    example: 'jperez@uandina.edu.pe',
    description: 'Correo institucional único',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Debe proporcionar un correo electrónico válido.' })
  @MaxLength(150)
  correo?: string;

  @ApiPropertyOptional({
    example: 'JCPG',
    description: 'Iniciales del operador para sellos de auditoría y resoluciones',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Las iniciales no pueden quedar vacías.' })
  @MaxLength(10, {
    message: 'Las iniciales no pueden exceder los 10 caracteres.',
  })
  iniciales?: string;

  @ApiPropertyOptional({
    enum: RolUsuario,
    example: RolUsuario.SECRETARIA_ACADEMICA,
  })
  @IsOptional()
  @IsEnum(RolUsuario, {
    message:
      'El rol debe ser ADMIN, DECANO, SECRETARIA_ACADEMICA o ADMINISTRATIVO.',
  })
  rol?: RolUsuario;

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

  @ApiPropertyOptional({
    example: 'UacFcsa2026!',
    description:
      'Nueva contraseña (opcional): mínimo 8 caracteres con mayúscula, minúscula y número',
  })
  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: 'La nueva contraseña debe tener al menos 8 caracteres.',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
    message:
      'La nueva contraseña debe incluir al menos una mayúscula, una minúscula y un número.',
  })
  nuevaPassword?: string;
}
