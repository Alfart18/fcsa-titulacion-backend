// Ruta: src/auditoria/dto/filtro-auditoria.dto.ts
import {
  IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FiltroAuditoriaDto {
  @IsOptional()
  @IsUUID('4', { message: 'El parámetro usuarioId debe ser un UUID válido' })
  usuarioId?: string;

  @IsOptional()
  @IsString({ message: 'El parámetro entidad debe ser una cadena de texto' })
  @MaxLength(60, { message: 'La entidad no puede exceder los 60 caracteres' })
  entidad?: string;

  @IsOptional()
  @IsString({ message: 'El parámetro accion debe ser una cadena de texto' })
  @MaxLength(50, { message: 'La acción no puede exceder los 50 caracteres' })
  accion?: string;

  @IsOptional()
  @IsDateString({}, { message: 'El parámetro fechaDesde debe tener un formato de fecha ISO válido (YYYY-MM-DD)' })
  fechaDesde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'El parámetro fechaHasta debe tener un formato de fecha ISO válido (YYYY-MM-DD)' })
  fechaHasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página mínima es 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite mínimo es 1' })
  @Max(100, { message: 'El límite máximo por página es 100' })
  limit?: number = 20;
}