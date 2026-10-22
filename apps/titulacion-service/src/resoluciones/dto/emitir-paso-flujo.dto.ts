import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ModalidadSustentacion } from '@prisma/client';

// DTO contenedor para el Body de POST /api/expedientes/:id/pasos/:tipo (Pasos 1 al 7)
export class EmitirPasoFlujoBodyDto {
  @IsOptional()
  @IsDateString({}, { message: 'fechaEmision debe tener formato YYYY-MM-DD válido.' })
  fechaEmision?: string;

  // ==========================================================================
  // PASO 1: NOMBRAMIENTO DE ASESOR (ORD)
  // ==========================================================================
  @IsOptional()
  @IsUUID('4', { message: 'asesorDocenteId debe ser un UUID válido.' })
  asesorDocenteId?: string;

  // ==========================================================================
  // PASO 2: DICTAMEN DE PROYECTO (ORD)
  // ==========================================================================
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-PE') : value,
  )
  @IsString()
  @MinLength(10, { message: 'El título del proyecto debe tener al menos 10 caracteres.' })
  @MaxLength(600, { message: 'El título del proyecto no puede exceder los 600 caracteres.' })
  tituloProyecto?: string;

  @IsOptional()
  @IsInt({ message: 'departamentoAcademicoId debe ser un número entero.' })
  @IsPositive()
  departamentoAcademicoId?: number;

  @IsOptional()
  @IsUUID('4', { message: 'dictaminante1Id debe ser un UUID válido.' })
  dictaminante1Id?: string;

  @IsOptional()
  @IsUUID('4', { message: 'dictaminante2Id debe ser un UUID válido.' })
  dictaminante2Id?: string;

  // ==========================================================================
  // PASO 4: TERCER DICTAMINANTE (ORD)
  // ==========================================================================
  @IsOptional()
  @IsUUID('4', { message: 'dictaminante3Id debe ser un UUID válido.' })
  dictaminante3Id?: string;

  // ==========================================================================
  // PASO 5 (APTO - CF) Y PASO 7 (TITULO - CF): IDENTIFICADOR DEL TESISTA
  // ==========================================================================
  @IsOptional()
  @IsUUID('4', { message: 'tesistaId debe ser un UUID válido.' })
  tesistaId?: string;

  // ==========================================================================
  // PASO 5: APTO PARA TÍTULO PROFESIONAL (CF - Individual por Tesista)
  // ==========================================================================
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MaxLength(120)
  numeroInformeSecretaria?: string;

  @IsOptional()
  @IsDateString({}, { message: 'fechaInformeSecretaria debe tener formato YYYY-MM-DD válido.' })
  fechaInformeSecretaria?: string;

  // ==========================================================================
  // PASO 6: FECHA Y HORA DE SUSTENTACIÓN (ORD - Jurado de 4 miembros)
  // ==========================================================================
  @IsOptional()
  @IsUUID('4', { message: 'presidenteDocenteId debe ser un UUID válido.' })
  presidenteDocenteId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'secretarioDocenteId debe ser un UUID válido.' })
  secretarioDocenteId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'vocalDocenteId debe ser un UUID válido.' })
  vocalDocenteId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'fechaSustentacion debe tener formato YYYY-MM-DD válido.' })
  fechaSustentacion?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'horaSustentacion debe tener formato 24h HH:mm (ej. 11:00 o 16:30).',
  })
  horaSustentacion?: string;

  @IsOptional()
  @IsEnum(ModalidadSustentacion, {
    message: 'La modalidad de sustentación debe ser PRESENCIAL o VIRTUAL.',
  })
  modalidad?: ModalidadSustentacion;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  lugarReferencia?: string;

  // ==========================================================================
  // PASO 7: TÍTULO PROFESIONAL (CF - Individual por Tesista, Nota 14 a 20)
  // (Blindado: NO acepta resultadoSustentacion para evitar Mass Assignment)
  // ==========================================================================
  @IsOptional()
  @IsInt({ message: 'La nota de sustentación debe ser un número entero.' })
  @Min(14, {
    message: 'Bloqueo normativo (Paso 7): La nota mínima aprobatoria para emitir Título Profesional es 14.',
  })
  @Max(20, { message: 'La nota máxima de sustentación es 20.' })
  notaSustentacion?: number;

  @IsOptional()
  @IsDateString({}, { message: 'fechaSustentacionReal debe tener formato YYYY-MM-DD válido.' })
  fechaSustentacionReal?: string;
}

// ============================================================================
// CLASES DE VALIDACIÓN ESTRICTA INTERNA SEGÚN EL PASO (:tipo)
// ============================================================================

export class ValidarPaso1AsesorDto {
  @IsUUID('4', { message: 'Debe seleccionar un docente asesor válido (UUID).' })
  @IsNotEmpty({ message: 'El campo asesorDocenteId es obligatorio para el Paso 1.' })
  asesorDocenteId!: string;
}

export class ValidarPaso2DictamenDto {
  @IsString()
  @IsNotEmpty({ message: 'El título del proyecto es obligatorio para el Paso 2.' })
  @MinLength(10)
  @MaxLength(600)
  tituloProyecto!: string;

  @IsInt({ message: 'Debe indicar el ID del Departamento Académico.' })
  @IsPositive()
  departamentoAcademicoId!: number;

  @IsUUID('4', { message: 'El Dictaminante 1 debe ser un UUID válido.' })
  dictaminante1Id!: string;

  @IsUUID('4', { message: 'El Dictaminante 2 debe ser un UUID válido.' })
  dictaminante2Id!: string;
}

export class ValidarPaso4TercerDictDto {
  @IsUUID('4', { message: 'Debe seleccionar el Tercer Dictaminante (UUID).' })
  @IsNotEmpty({ message: 'El campo dictaminante3Id es obligatorio para el Paso 4.' })
  dictaminante3Id!: string;
}

export class ValidarPaso5AptoDto {
  @IsUUID('4', { message: 'Debe indicar el tesistaId válido (UUID) para emitir su Apto individual.' })
  @IsNotEmpty({ message: 'tesistaId es obligatorio para el Paso 5 (Apto).' })
  tesistaId!: string;

  @IsString()
  @IsNotEmpty({ message: 'El número de informe de Secretaría Académica es obligatorio.' })
  @MaxLength(120)
  numeroInformeSecretaria!: string;

  @IsDateString({}, { message: 'La fecha del informe de Secretaría Académica (YYYY-MM-DD) es obligatoria.' })
  fechaInformeSecretaria!: string;
}

export class ValidarPaso6FechaHoraDto {
  @IsUUID('4', { message: 'El Presidente del Jurado debe ser un UUID válido.' })
  presidenteDocenteId!: string;

  @IsUUID('4', { message: 'El Secretario del Jurado debe ser un UUID válido.' })
  secretarioDocenteId!: string;

  @IsUUID('4', { message: 'El Vocal/Dictaminante del Jurado debe ser un UUID válido.' })
  vocalDocenteId!: string;

  @IsDateString({}, { message: 'La fecha programada de sustentación (YYYY-MM-DD) es obligatoria.' })
  fechaSustentacion!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'La hora de sustentación debe tener formato HH:mm (ej. 11:00).',
  })
  horaSustentacion!: string;

  @IsEnum(ModalidadSustentacion, {
    message: 'La modalidad debe ser PRESENCIAL o VIRTUAL.',
  })
  modalidad!: ModalidadSustentacion;

  @IsString()
  @IsNotEmpty({ message: 'El lugar o referencia de sustentación (ej. Salón de Grados) es obligatorio.' })
  @MaxLength(200)
  lugarReferencia!: string;
}

export class ValidarPaso7TituloDto {
  @IsUUID('4', { message: 'Debe indicar el tesistaId válido (UUID) para emitir su Título Profesional.' })
  @IsNotEmpty({ message: 'tesistaId es obligatorio para el Paso 7 (Título Profesional).' })
  tesistaId!: string;

  @IsInt({ message: 'La nota de sustentación debe ser un número entero.' })
  @Min(14, {
    message: 'Bloqueo normativo: No se puede emitir resolución de Título con nota menor a 14.',
  })
  @Max(20, { message: 'La nota máxima permitida es 20.' })
  notaSustentacion!: number;

  @IsDateString({}, { message: 'La fecha real de sustentación (YYYY-MM-DD) es obligatoria.' })
  fechaSustentacionReal!: string;
}