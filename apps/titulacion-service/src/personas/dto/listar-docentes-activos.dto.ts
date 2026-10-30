// Ruta: src/personas/dto/listar-docentes-activos.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class ListarDocentesActivosDto {
  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto.' })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El filtro departamentoId debe ser un número entero.' })
  @IsPositive({ message: 'El filtro departamentoId debe ser mayor a cero.' })
  departamentoId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El filtro escuelaId debe ser un número entero.' })
  @IsPositive({ message: 'El filtro escuelaId debe ser mayor a cero.' })
  escuelaId?: number;
}