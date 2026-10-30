// Ruta: src/catalogos/dto/listar-causas.dto.ts
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { AmbitoCausa } from '../../generated/client';

export class ListarCausasDto {
  @IsOptional()
  @IsEnum(AmbitoCausa, {
    message: 'El ámbito debe ser uno de los siguientes valores: CAMBIO_ASESOR, CAMBIO_DICTAMINANTE, DSE, DOCUMENTO_EXTERNO.',
  })
  ambito?: AmbitoCausa;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({
    message: 'El parámetro incluirInactivos debe ser un valor booleano.',
  })
  incluirInactivos?: boolean = false;
}