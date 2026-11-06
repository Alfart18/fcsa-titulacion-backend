// Ruta: apps/identidad-service/src/auditoria/dto/filtro-auditoria.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class FiltroAuditoriaDto {
  @ApiPropertyOptional({ description: 'Filtrar por UUID del usuario ejecutor' })
  @IsOptional()
  @IsUUID('4', { message: 'El parámetro usuarioId debe ser un UUID válido' })
  usuarioId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por entidad afectada (ej. usuarios)' })
  @IsOptional()
  @IsString({ message: 'El parámetro entidad debe ser una cadena de texto' })
  @MaxLength(60, { message: 'La entidad no puede exceder los 60 caracteres' })
  entidad?: string;

  @ApiPropertyOptional({ description: 'Filtrar por acción (ej. GESTION_USUARIO)' })
  @IsOptional()
  @IsString({ message: 'El parámetro accion debe ser una cadena de texto' })
  @MaxLength(50, { message: 'La acción no puede exceder los 50 caracteres' })
  accion?: string;

  @ApiPropertyOptional({ description: 'Fecha inicial en formato ISO (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'El parámetro fechaDesde debe tener un formato de fecha ISO válido (YYYY-MM-DD)',
    },
  )
  fechaDesde?: string;

  @ApiPropertyOptional({ description: 'Fecha final en formato ISO (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'El parámetro fechaHasta debe tener un formato de fecha ISO válido (YYYY-MM-DD)',
    },
  )
  fechaHasta?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página mínima es 1' })
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite mínimo es 1' })
  @Max(100, { message: 'El límite máximo por página es 100' })
  limit?: number = 20;
}