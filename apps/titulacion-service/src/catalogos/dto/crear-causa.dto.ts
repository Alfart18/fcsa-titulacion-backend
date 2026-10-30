// Ruta: src/catalogos/dto/crear-causa.dto.ts
import {
  IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength,
} from 'class-validator';
import { AmbitoCausa } from '../../generated/client';

export class CrearCausaDto {
  @IsEnum(AmbitoCausa, {
    message: 'El ámbito debe ser uno de los siguientes valores: CAMBIO_ASESOR, CAMBIO_DICTAMINANTE, DSE, DOCUMENTO_EXTERNO.',
  })
  @IsNotEmpty({ message: 'El ámbito de la causa es obligatorio.' })
  ambito: AmbitoCausa;

  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La descripción de la causa es obligatoria.' })
  @MaxLength(160, { message: 'La descripción de la causa no puede exceder los 160 caracteres.' })
  descripcion: string;

  @IsOptional()
  @IsBoolean({ message: 'El campo requiereDetalleManual debe ser un valor booleano.' })
  requiereDetalleManual?: boolean = false;
}