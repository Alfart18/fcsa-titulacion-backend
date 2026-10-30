// Ruta: src/personas/dto/crear-estudiante.dto.ts
import {
  IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength,
} from 'class-validator';

export class CrearEstudianteDto {
  @IsString({ message: 'Los nombres deben ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Los nombres son obligatorios.' })
  @MaxLength(120, { message: 'Los nombres no pueden exceder los 120 caracteres.' })
  nombres: string;

  @IsString({ message: 'El apellido paterno debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El apellido paterno es obligatorio.' })
  @MaxLength(100, { message: 'El apellido paterno no puede exceder los 100 caracteres.' })
  apellidoPaterno: string;

  @IsString({ message: 'El apellido materno debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El apellido materno es obligatorio.' })
  @MaxLength(100, { message: 'El apellido materno no puede exceder los 100 caracteres.' })
  apellidoMaterno: string;

  @IsString({ message: 'El código universitario debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El código universitario es obligatorio.' })
  @MaxLength(20, { message: 'El código universitario no puede exceder los 20 caracteres.' })
  @Matches(/^[0-9]{9}[a-zA-Z]$/, {
    message: 'El código universitario debe tener exactamente 9 números seguidos de 1 letra (ej. 019200997j).',
  })
  codigoUniversitario: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo no puede exceder los 150 caracteres.' })
  correo?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El teléfono no puede exceder los 30 caracteres.' })
  telefono?: string;
}