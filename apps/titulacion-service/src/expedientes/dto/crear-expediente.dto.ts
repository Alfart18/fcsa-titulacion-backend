import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class TesistaInputDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-PE') : value,
  )
  @IsString({ message: 'El nombre del tesista debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Los nombres y apellidos del tesista son obligatorios.' })
  @MinLength(5, { message: 'El nombre completo del tesista debe tener al menos 5 caracteres.' })
  @MaxLength(200)
  nombresApellidos!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, '').toUpperCase() : value,
  )
  @IsString({ message: 'El código de estudiante debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El código universitario del estudiante es obligatorio.' })
  @MinLength(6, { message: 'El código de estudiante debe tener al menos 6 caracteres.' })
  @MaxLength(25)
  codigoEstudiante!: string;
}

export class CrearExpedienteDto {
  @IsInt({ message: 'El ID de la Escuela Profesional debe ser un número entero.' })
  @IsPositive({ message: 'Debe seleccionar una Escuela Profesional válida.' })
  escuelaProfesionalId!: number;

  @IsArray({ message: 'Debe enviar la lista de tesistas en un arreglo.' })
  @ArrayMinSize(1, { message: 'El expediente debe tener como mínimo 1 tesista.' })
  @ArrayMaxSize(2, { message: 'Un expediente de titulación puede tener como máximo 2 tesistas.' })
  @ValidateNested({ each: true })
  @Type(() => TesistaInputDto)
  tesistas!: TesistaInputDto[];
}