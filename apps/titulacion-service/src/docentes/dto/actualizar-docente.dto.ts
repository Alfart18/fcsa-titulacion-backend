import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EstadoDocente } from '@prisma/client';
import { GRADOS_DOCENTE_PERMITIDOS } from './crear-docente.dto';

export class ActualizarDocenteDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsIn(GRADOS_DOCENTE_PERMITIDOS, {
    message: `El grado académico debe ser uno de la lista oficial: ${GRADOS_DOCENTE_PERMITIDOS.join(', ')}`,
  })
  gradoAcademico?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-PE') : value,
  )
  @IsString()
  @MaxLength(200)
  nombresCompletos?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'El formato del correo institucional no es válido.' })
  @MaxLength(150)
  correo?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  departamentoAcademicoId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  escuelaProfesionalId?: number;

  @IsOptional()
  @IsEnum(EstadoDocente, { message: 'El estado del docente debe ser ACTIVO o INACTIVO.' })
  estado?: EstadoDocente;
}