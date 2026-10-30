// Ruta: src/personas/dto/listar-personas.dto.ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListarPersonasDto {
  @IsOptional()
  @IsIn(['docente', 'estudiante'], {
    message: 'El filtro tipo solo permite los valores "docente" o "estudiante".',
  })
  tipo?: 'docente' | 'estudiante';

  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto.' })
  q?: string;

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