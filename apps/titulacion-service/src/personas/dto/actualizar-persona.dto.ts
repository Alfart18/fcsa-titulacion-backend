// Ruta: src/personas/dto/actualizar-persona.dto.ts
import { Type } from 'class-transformer';
import {
  IsEmail, IsEnum, IsInt, IsOptional, IsPositive, IsString, Matches, MaxLength,
} from 'class-validator';
import { EstadoDocente } from '../../generated/client';

export class ActualizarPersonaDto {
  @IsOptional()
  @IsString({ message: 'Los nombres deben ser una cadena de texto.' })
  @MaxLength(120, { message: 'Los nombres no pueden exceder los 120 caracteres.' })
  nombres?: string;

  @IsOptional()
  @IsString({ message: 'El apellido paterno debe ser una cadena de texto.' })
  @MaxLength(100, { message: 'El apellido paterno no puede exceder los 100 caracteres.' })
  apellidoPaterno?: string;

  @IsOptional()
  @IsString({ message: 'El apellido materno debe ser una cadena de texto.' })
  @MaxLength(100, { message: 'El apellido materno no puede exceder los 100 caracteres.' })
  apellidoMaterno?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo no puede exceder los 150 caracteres.' })
  correo?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El teléfono no puede exceder los 30 caracteres.' })
  telefono?: string;

  @IsOptional()
  @IsString({ message: 'El código universitario debe ser una cadena de texto.' })
  @MaxLength(20, { message: 'El código universitario no puede exceder los 20 caracteres.' })
  @Matches(/^[0-9]{9}[a-zA-Z]$/, {
    message: 'El código universitario debe tener exactamente 9 números seguidos de 1 letra (ej. 019200997j).',
  })
  codigoUniversitario?: string;

  @IsOptional()
  @IsString({ message: 'El grado académico debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El grado académico no puede exceder los 30 caracteres.' })
  gradoAcademico?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El ID del departamento académico debe ser un número entero.' })
  @IsPositive({ message: 'El ID del departamento académico debe ser mayor a cero.' })
  departamentoAcademicoId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El ID de la escuela profesional debe ser un número entero.' })
  @IsPositive({ message: 'El ID de la escuela profesional debe ser mayor a cero.' })
  escuelaProfesionalId?: number;

  @IsOptional()
  @IsEnum(EstadoDocente, {
    message: 'El estado del docente debe ser ACTIVO, INACTIVO o CESANTE.',
  })
  estadoDocente?: EstadoDocente;
}