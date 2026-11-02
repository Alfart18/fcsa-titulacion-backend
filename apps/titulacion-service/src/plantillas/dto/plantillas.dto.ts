// Ruta: src/plantillas/dto/plantillas.dto.ts
import {
  IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator';
import { SerieNumeracion } from '../../generated/client';

export class ActualizarPlantillaDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsEnum(SerieNumeracion)
  seriePorDefecto?: SerieNumeracion;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  asuntoPlantilla: string;

  @IsString()
  @IsNotEmpty()
  cuerpoHtml: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  motivoCambio?: string;
}

export class PrevisualizarPlantillaDto {
  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsOptional()
  @IsUUID()
  tesistaId?: string;

  @IsOptional()
  @IsObject()
  variablesExtra?: Record<string, any>;
}