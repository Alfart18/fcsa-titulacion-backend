// Ruta: src/catalogos/dto/actualizar-causa.dto.ts
import {
  IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength,
} from 'class-validator';
import { AmbitoCausa } from '../../generated/client';

export class ActualizarCausaDto {
  @IsOptional()
  @IsEnum(AmbitoCausa, {
    message: 'El ámbito debe ser uno de los siguientes valores: CAMBIO_ASESOR, CAMBIO_DICTAMINANTE, DSE, DOCUMENTO_EXTERNO.',
  })
  ambito?: AmbitoCausa;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La descripción no puede estar vacía.' })
  @MaxLength(160, { message: 'La descripción de la causa no puede exceder los 160 caracteres.' })
  descripcion?: string;

  @IsOptional()
  @IsBoolean({ message: 'El campo requiereDetalleManual debe ser un valor booleano.' })
  requiereDetalleManual?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'El campo activo debe ser un valor booleano.' })
  activo?: boolean;
}