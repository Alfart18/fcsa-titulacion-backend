import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AmbitoCausa, SerieNumeracion } from '@prisma/client';

// ============================================================================
// 1. CAMBIO DE ASESOR (Serie ORD - Ámbito Causa: CAMBIO_ASESOR)
// ============================================================================
export class EmitirCambioAsesorDto {
  @IsUUID('4', { message: 'nuevoAsesorDocenteId debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'Debe seleccionar al nuevo docente asesor.' })
  nuevoAsesorDocenteId!: string;

  @IsInt({ message: 'causaId debe ser un número entero.' })
  @IsPositive({ message: 'Debe seleccionar una causa válida del catálogo.' })
  causaId!: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(300)
  detalleCausaManual?: string;

  @IsOptional()
  @IsDateString({}, { message: 'fechaEmision debe tener formato YYYY-MM-DD válido.' })
  fechaEmision?: string;
}

// ============================================================================
// 2. CAMBIO DE TÍTULO - DICE / DEBE DECIR (Serie ORD - Sin Causa por RN-CT-16)
// ============================================================================
export class EmitirCambioTituloDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-PE') : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'El nuevo título (DEBE DECIR) es obligatorio.' })
  @MinLength(10, { message: 'El nuevo título debe tener al menos 10 caracteres.' })
  @MaxLength(600, { message: 'El nuevo título no puede exceder los 600 caracteres.' })
  nuevoTitulo!: string;

  @IsOptional()
  @IsDateString({}, { message: 'fechaEmision debe tener formato YYYY-MM-DD válido.' })
  fechaEmision?: string;
}

// ============================================================================
// 3. CAMBIO DE DICTAMINANTE (Serie ORD - Bloqueado en Paso 6 - Ámbito: CAMBIO_DICTAMINANTE)
// ============================================================================
export class EmitirCambioDictaminanteDto {
  @IsUUID('4', { message: 'dictaminanteSalienteId debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'Debe indicar el dictaminante vigente que será reemplazado.' })
  dictaminanteSalienteId!: string;

  @IsUUID('4', { message: 'dictaminanteEntranteId debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'Debe indicar el nuevo docente dictaminante.' })
  dictaminanteEntranteId!: string;

  @IsInt({ message: 'causaId debe ser un número entero.' })
  @IsPositive({ message: 'Debe seleccionar una causa válida del catálogo.' })
  causaId!: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(300)
  detalleCausaManual?: string;

  @IsOptional()
  @IsDateString({}, { message: 'fechaEmision debe tener formato YYYY-MM-DD válido.' })
  fechaEmision?: string;
}

// ============================================================================
// 4. DESISTIMIENTO DE TESISTA (Serie ORD - Solo 2 tesistas activos y antes de Paso 6)
// ============================================================================
export class EmitirDesistimientoDto {
  @IsUUID('4', { message: 'tesistaDesistenteId debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'Debe seleccionar al tesista que presenta el desistimiento.' })
  tesistaDesistenteId!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty({ message: 'La referencia de la solicitud externa de desistimiento es obligatoria.' })
  @MaxLength(150)
  referenciaSolicitudExterna!: string;

  @IsOptional()
  @IsDateString({}, { message: 'fechaSolicitudExterna debe tener formato YYYY-MM-DD válido.' })
  fechaSolicitudExterna?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(400)
  fundamentoSolicitud?: string;

  @IsOptional()
  @IsDateString({}, { message: 'fechaEmision debe tener formato YYYY-MM-DD válido.' })
  fechaEmision?: string;
}

// ============================================================================
// 5. DEJAR SIN EFECTO - DSE (Serie ORD o CF - Ámbito Causa: DSE)
// ============================================================================
export class EmitirDejarSinEfectoDto {
  @IsEnum(SerieNumeracion, { message: 'La serie del DSE debe ser ORD o CF.' })
  serie!: SerieNumeracion;

  @IsArray({ message: 'resolucionesAfectadasIds debe ser un arreglo de UUIDs.' })
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos una resolución vigente para dejar sin efecto.' })
  @IsUUID('4', { each: true, message: 'Cada ID de resolución afectada debe ser un UUID válido.' })
  resolucionesAfectadasIds!: string[];

  @IsInt({ message: 'causaId debe ser un número entero.' })
  @IsPositive({ message: 'Debe seleccionar una causa de DSE válida del catálogo.' })
  causaId!: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(300)
  detalleCausaManual?: string;

  @IsBoolean({ message: 'reinicioIntegral debe ser un valor booleano (true o false).' })
  reinicioIntegral!: boolean;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  disposicionComplementaria?: string;

  @IsOptional()
  @IsDateString({}, { message: 'fechaEmision debe tener formato YYYY-MM-DD válido.' })
  fechaEmision?: string;
}

// ============================================================================
// 6. REGISTRO DE DOCUMENTOS ADMINISTRATIVOS EXTERNOS (LibroNumeracion)
// ============================================================================
export class RegistrarDocumentoExternoDto {
  @IsEnum(SerieNumeracion, { message: 'La serie de numeración debe ser ORD o CF.' })
  serie!: SerieNumeracion;

  @IsInt({ message: 'causaTipoId debe ser un número entero del catálogo (DOCUMENTO_EXTERNO).' })
  @IsPositive()
  causaTipoId!: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  detalleTipoManual?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'La descripción o asunto del documento externo es obligatoria.' })
  @MinLength(5, { message: 'La descripción debe tener al menos 5 caracteres.' })
  @MaxLength(500)
  descripcion!: string;

  @IsOptional()
  @IsDateString({}, { message: 'fechaDocumento debe tener formato YYYY-MM-DD válido.' })
  fechaDocumento?: string;
}

// ============================================================================
// 7. CRUD DEL CATÁLOGO DE CAUSAS Y TIPOS (CatalogoCausa)
// ============================================================================
export class CrearCatalogoCausaDto {
  @IsEnum(AmbitoCausa, {
    message: 'El ámbito debe ser CAMBIO_ASESOR, CAMBIO_DICTAMINANTE, DSE o DOCUMENTO_EXTERNO.',
  })
  ambito!: AmbitoCausa;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'La descripción de la causa o tipo es obligatoria.' })
  @MaxLength(160)
  descripcion!: string;

  @IsOptional()
  @IsBoolean()
  requiereDetalleManual?: boolean;
}

export class ActualizarCatalogoCausaDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(160)
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  requiereDetalleManual?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}