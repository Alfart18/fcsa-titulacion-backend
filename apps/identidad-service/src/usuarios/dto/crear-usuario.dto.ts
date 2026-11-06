// Ruta: apps/identidad-service/src/usuarios/dto/crear-usuario.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { RolUsuario } from '../../generated/client';

export class CrearUsuarioDto {
  @ApiProperty({
    example: 'JUAN CARLOS PÉREZ GÓMEZ',
    description: 'Nombres y apellidos completos del usuario',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Los nombres completos son obligatorios.' })
  @MaxLength(180)
  nombresCompletos!: string;

  @ApiProperty({
    example: 'Dr.',
    description: 'Grado o título abreviado (Dr., Mg., Lic., Ing., Sr.)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({
    message: 'El grado o título abreviado (ej. Dr., Mgt., Lic., Ing.) es obligatorio.',
  })
  @MaxLength(50)
  gradoTitulo!: string;

  @ApiProperty({
    example: 'jperez@uandina.edu.pe',
    description: 'Correo institucional único',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Debe proporcionar un correo electrónico válido.' })
  @MaxLength(150)
  correo!: string;

  @ApiProperty({
    example: 'UacFcsa2026!',
    description: 'Contraseña de mínimo 8 caracteres con mayúscula, minúscula y número',
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
    message:
      'La contraseña debe incluir al menos una mayúscula, una minúscula y un número.',
  })
  password!: string;

  @ApiProperty({
    example: 'JCPG',
    description: 'Iniciales del operador para sellos de auditoría y resoluciones',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Las iniciales del usuario son obligatorias.' })
  @MaxLength(10, { message: 'Las iniciales no pueden exceder los 10 caracteres.' })
  iniciales!: string;

  @ApiProperty({
    enum: RolUsuario,
    example: RolUsuario.ADMINISTRATIVO,
  })
  @IsEnum(RolUsuario, {
    message:
      'El rol debe ser ADMIN, DECANO, SECRETARIA_ACADEMICA o ADMINISTRATIVO.',
  })
  rol!: RolUsuario;

  @ApiPropertyOptional({
    example: false,
    description: 'Indica si el usuario (con rol DECANO) es el firmante activo',
  })
  @IsOptional()
  @IsBoolean()
  esDecanoFirmante?: boolean;
}