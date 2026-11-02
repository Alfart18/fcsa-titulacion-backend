// Ruta: src/expedientes/dto/crear-tesista.dto.ts
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CrearTesistaDto {
  @IsString({ message: 'Los nombres del tesista deben ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Los nombres del tesista son obligatorios.' })
  @MaxLength(120, { message: 'Los nombres no pueden exceder los 120 caracteres.' })
  nombres: string;

  @IsString({ message: 'El apellido paterno del tesista debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El apellido paterno del tesista es obligatorio.' })
  @MaxLength(100, { message: 'El apellido paterno no puede exceder los 100 caracteres.' })
  apellidoPaterno: string;

  @IsString({ message: 'El apellido materno del tesista debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El apellido materno del tesista es obligatorio.' })
  @MaxLength(100, { message: 'El apellido materno no puede exceder los 100 caracteres.' })
  apellidoMaterno: string;

  @IsString({ message: 'El código universitario debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El código universitario es obligatorio.' })
  @Matches(/^[0-9]{9}[a-zA-Z]$/, {
    message: 'El código universitario debe tener exactamente 9 dígitos seguidos de una letra (ej. 019100123A).',
  })
  codigoUniversitario: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El teléfono no puede exceder los 30 caracteres.' })
  telefono?: string;
}