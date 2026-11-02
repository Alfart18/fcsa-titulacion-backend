// Ruta: src/libros/dto/libros.dto.ts
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SerieNumeracion, CategoriaNumeracion } from '../../generated/client';

export class ReservarNumeracionExternaDto {
  @IsEnum(SerieNumeracion, {
    message: 'La serie debe ser ORD o CF',
  })
  serie: SerieNumeracion;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  anio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  causaCatalogoId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipoDocumentoExterno?: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción o sumilla del documento es obligatoria' })
  descripcion: string;

  @IsOptional()
  @IsDateString()
  fechaDocumento?: string;
}

export class FiltroLibroNumeracionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  anio?: number;

  @IsOptional()
  @IsEnum(SerieNumeracion)
  serie?: SerieNumeracion;

  @IsOptional()
  @IsEnum(CategoriaNumeracion)
  categoria?: CategoriaNumeracion;

  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class FiltroLibroInscripcionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  escuelaProfesionalId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  anio?: number;

  @IsOptional()
  @IsString()
  estadoAsiento?: string;

  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class FiltroLibroTituloDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  escuelaProfesionalId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  anioRegistro?: number;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}