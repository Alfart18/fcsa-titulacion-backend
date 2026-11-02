// Ruta: src/expedientes/dto/resolucion-historica.dto.ts
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ResolucionHistoricaDto {
  @IsString({ message: 'El número completo de la resolución histórica debe ser texto.' })
  @IsNotEmpty({ message: 'El número completo de la resolución histórica es obligatorio.' })
  @MaxLength(50, { message: 'El número completo de la resolución no puede exceder los 50 caracteres.' })
  numeroCompleto: string;

  @IsDateString({}, { message: 'La fecha de emisión de la resolución histórica debe tener formato ISO (YYYY-MM-DD).' })
  @IsNotEmpty({ message: 'La fecha de emisión de la resolución histórica es obligatoria.' })
  fechaEmision: string;

  @IsOptional()
  @IsString({ message: 'El nombre del asesor debe ser una cadena de texto.' })
  @MaxLength(200, { message: 'El nombre del asesor no puede exceder los 200 caracteres.' })
  nombreAsesor?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del docente asesor debe ser un UUID v4 válido.' })
  asesorDocenteId?: string;

  @IsOptional()
  @IsString({ message: 'El nombre de los dictaminantes debe ser una cadena de texto.' })
  @MaxLength(400, { message: 'El nombre de los dictaminantes no puede exceder los 400 caracteres.' })
  nombreDictaminantes?: string;

  @IsOptional()
  @IsString({ message: 'El nombre del primer dictaminante debe ser una cadena de texto.' })
  @MaxLength(200, { message: 'El nombre del primer dictaminante no puede exceder los 200 caracteres.' })
  nombreDictaminante1?: string;

  @IsOptional()
  @IsString({ message: 'El nombre del segundo dictaminante debe ser una cadena de texto.' })
  @MaxLength(200, { message: 'El nombre del segundo dictaminante no puede exceder los 200 caracteres.' })
  nombreDictaminante2?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del primer dictaminante debe ser un UUID v4 válido.' })
  dictaminante1Id?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del segundo dictaminante debe ser un UUID v4 válido.' })
  dictaminante2Id?: string;

  @IsOptional()
  @IsString({ message: 'El título de la tesis debe ser una cadena de texto.' })
  @MaxLength(500, { message: 'El título de la tesis no puede exceder los 500 caracteres.' })
  tituloTesis?: string;
}