// Ruta: src/expedientes/dto/crear-expediente.dto.ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { EstadoExpediente } from '../../generated/client';
import { CrearTesistaDto } from './crear-tesista.dto';
import { ResolucionHistoricaDto } from './resolucion-historica.dto';

export class CrearExpedienteDto {
  @Type(() => Number)
  @IsInt({ message: 'El ID de la escuela profesional debe ser un número entero.' })
  @IsPositive({ message: 'El ID de la escuela profesional debe ser mayor a cero.' })
  escuelaProfesionalId: number;

  @Type(() => Number)
  @IsInt({ message: 'La cantidad de tesistas debe ser un número entero.' })
  @Min(1, { message: 'El expediente debe tener como mínimo 1 tesista.' })
  @Max(2, { message: 'El expediente puede tener como máximo 2 tesistas.' })
  cantidadTesistas: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El paso actual debe ser un número entero.' })
  @Min(1, { message: 'El paso inicial mínimo permitido es 1.' })
  @Max(7, { message: 'El paso inicial máximo permitido es 7.' })
  pasoActual?: number = 1;

  @IsOptional()
  @IsString({ message: 'El título actual de la tesis debe ser una cadena de texto.' })
  @MaxLength(500, { message: 'El título de la tesis no puede exceder los 500 caracteres.' })
  tituloActual?: string;

  @IsArray({ message: 'El campo tesistas debe ser un arreglo.' })
  @ArrayMinSize(1, { message: 'Debe registrar al menos 1 tesista.' })
  @ArrayMaxSize(2, { message: 'Solo se permiten hasta 2 tesistas por expediente.' })
  @ValidateNested({ each: true })
  @Type(() => CrearTesistaDto)
  tesistas: CrearTesistaDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ResolucionHistoricaDto)
  resolucionAsesor?: ResolucionHistoricaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ResolucionHistoricaDto)
  resolucionDictaminantes?: ResolucionHistoricaDto;
}

export class CambiarEstadoExpedienteDto {
  @IsEnum(EstadoExpediente, { message: 'El estado del expediente debe ser EN_PROCESO, FINALIZADO o ANULADO.' })
  @IsNotEmpty({ message: 'El nuevo estado del expediente es obligatorio.' })
  estado: EstadoExpediente;
}