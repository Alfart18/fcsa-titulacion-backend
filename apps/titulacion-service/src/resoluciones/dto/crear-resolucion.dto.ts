// Ruta: src/resoluciones/dto/crear-resolucion.dto.ts
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { SerieNumeracion, TipoResolucion } from '../../generated/client';

export class CrearResolucionDto {
  @IsUUID('4', { message: 'El ID del expediente debe ser un UUID v4 válido.' })
  @IsNotEmpty({ message: 'El ID del expediente es obligatorio.' })
  expedienteId: string;

  @IsEnum(TipoResolucion, {
    message:
      'El tipo de resolución no es válido. Debe pertenecer al catálogo TipoResolucion.',
  })
  @IsNotEmpty({ message: 'El tipo de resolución es obligatorio.' })
  tipo: TipoResolucion;

  @IsOptional()
  @IsEnum(SerieNumeracion, {
    message: 'La serie de numeración debe ser ORD o CF.',
  })
  serie?: SerieNumeracion;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del tesista debe ser un UUID v4 válido.' })
  tesistaId?: string;

  @IsOptional()
  @IsUUID('4', {
    message: 'El ID de la resolución antecedente debe ser un UUID v4 válido.',
  })
  resolucionAntecedenteId?: string;

  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'La fecha de emisión debe tener un formato ISO válido (YYYY-MM-DD).',
    },
  )
  fechaEmision?: string;

  @IsObject({
    message: 'El campo datosEspecificos debe ser un objeto JSON válido.',
  })
  @IsNotEmpty({
    message: 'Los datos específicos de la resolución son obligatorios.',
  })
  datosEspecificos: Record<string, unknown>;
}