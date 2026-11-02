// Ruta: src/expedientes/dto/listar-expedientes.dto.ts
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { EstadoExpediente } from '../../generated/client';

export class ListarExpedientesDto {
  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto.' })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El filtro escuelaProfesionalId debe ser un número entero.' })
  @IsPositive({ message: 'El filtro escuelaProfesionalId debe ser mayor a cero.' })
  escuelaProfesionalId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El filtro escuelaId debe ser un número entero.' })
  @IsPositive({ message: 'El filtro escuelaId debe ser mayor a cero.' })
  escuelaId?: number;

  @IsOptional()
  @IsEnum(EstadoExpediente, { message: 'El filtro de estado debe ser EN_PROCESO, FINALIZADO o ANULADO.' })
  estado?: EstadoExpediente;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El filtro pasoActual debe ser un número entero.' })
  @Min(1, { message: 'El pasoActual mínimo es 1.' })
  @Max(7, { message: 'El pasoActual máximo es 7.' })
  pasoActual?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El número de página debe ser un entero.' })
  @Min(1, { message: 'El número de página mínimo es 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite por página debe ser un entero.' })
  @Min(1, { message: 'El límite mínimo por página es 1.' })
  @Max(100, { message: 'El límite máximo por página es 100.' })
  limit?: number = 20;
}