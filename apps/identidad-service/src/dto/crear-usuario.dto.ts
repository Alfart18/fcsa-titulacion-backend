import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { RolUsuario } from '@prisma/client';

export class CrearUsuarioDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty({ message: 'Los nombres completos son obligatorios.' })
  @MaxLength(180)
  nombresCompletos!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El grado o título abreviado (ej. Dr., Mgt., Lic., Ing.) es obligatorio.' })
  @MaxLength(50)
  gradoTitulo!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Debe proporcionar un correo electrónico válido.' })
  @MaxLength(150)
  correo!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
    message: 'La contraseña debe incluir al menos una mayúscula, una minúscula y un número.',
  })
  password!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty({ message: 'Las iniciales del usuario son obligatorias.' })
  @MaxLength(10, { message: 'Las iniciales no pueden exceder los 10 caracteres.' })
  iniciales!: string;

  @IsEnum(RolUsuario, {
    message: 'El rol debe ser DECANO, SECRETARIA_ACADEMICA o ADMINISTRATIVO.',
  })
  rol!: RolUsuario;

  @IsOptional()
  @IsBoolean()
  esDecanoFirmante?: boolean;
}