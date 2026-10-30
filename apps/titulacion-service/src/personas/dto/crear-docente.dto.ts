// Ruta: src/personas/dto/crear-docente.dto.ts
import { Type } from 'class-transformer';
import {
  IsEmail, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength,
} from 'class-validator';

export class CrearDocenteDto {
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

  @IsEmail({}, { message: 'El correo institucional no tiene un formato válido.' })
  @IsNotEmpty({ message: 'El correo institucional es obligatorio para docentes.' })
  @MaxLength(150, { message: 'El correo no puede exceder los 150 caracteres.' })
  correo: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El teléfono no puede exceder los 30 caracteres.' })
  telefono?: string;

  @IsString({ message: 'El grado académico debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El grado académico es obligatorio (ej. Dr., Mg., Lic.).' })
  @MaxLength(30, { message: 'El grado académico no puede exceder los 30 caracteres.' })
  gradoAcademico: string;

  @Type(() => Number)
  @IsInt({ message: 'El ID del departamento académico debe ser un número entero.' })
  @IsPositive({ message: 'El ID del departamento académico debe ser mayor a cero.' })
  departamentoAcademicoId: number;

  @Type(() => Number)
  @IsInt({ message: 'El ID de la escuela profesional debe ser un número entero.' })
  @IsPositive({ message: 'El ID de la escuela profesional debe ser mayor a cero.' })
  escuelaProfesionalId: number;
}