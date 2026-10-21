import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export const GRADOS_DOCENTE_PERMITIDOS = [
  'Dr.',
  'Dra.',
  'Mg.',
  'Mgt.',
  'Mtro.',
  'Mtra.',
  'Lic.',
  'Obst.',
  'M.C.',
  'C.D.',
  'Mgt. TM.',
  'Lic. TM.',
] as const;

export class CrearDocenteDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsIn(GRADOS_DOCENTE_PERMITIDOS, {
    message: `El grado académico debe ser uno de la lista oficial: ${GRADOS_DOCENTE_PERMITIDOS.join(', ')}`,
  })
  gradoAcademico!: string;

  // Normaliza a MAYÚSCULAS conservando tildes (ÁÉÍÓÚ) y la letra Ñ
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-PE') : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Los nombres y apellidos del docente son obligatorios.' })
  @MaxLength(200)
  nombresCompletos!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'El formato del correo institucional no es válido.' })
  @MaxLength(150)
  correo!: string;

  @IsInt({ message: 'El ID del Departamento Académico debe ser un número entero.' })
  @IsPositive()
  departamentoAcademicoId!: number;

  @IsInt({ message: 'El ID de la Escuela Profesional principal debe ser un número entero.' })
  @IsPositive()
  escuelaProfesionalId!: number;
}