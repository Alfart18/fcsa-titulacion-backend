// Ruta: apps/documentos-service/src/templates/interfaces/template.interface.ts

export enum SerieNumeracion {
  ORD = 'ORD',
  CF = 'CF',
}

export enum TipoResolucion {
  ASESOR = 'ASESOR',
  DICTAMEN = 'DICTAMEN',
  INSCRIPCION = 'INSCRIPCION',
  TERCER_DICT = 'TERCER_DICT',
  APTO = 'APTO',
  FECHA_HORA = 'FECHA_HORA',
  TITULO = 'TITULO',
  COASESOR = 'COASESOR',
  CAMBIO_ASESOR = 'CAMBIO_ASESOR',
  CAMBIO_TITULO = 'CAMBIO_TITULO',
  CAMBIO_DICTAMINANTE = 'CAMBIO_DICTAMINANTE',
  DSE = 'DSE',
  DESISTIMIENTO = 'DESISTIMIENTO',
}

export interface TesistaSnapshot {
  id: string;
  orden?: number;
  nombresApellidos: string;
  codigoEstudiante: string;
}

export interface SeccionesJuridicasResult {
  visto: string;
  considerando: string[];
  articulosResolutivos: Array<{ titulo: string; texto: string }>;
}

// ============================================================================
// ENUMS Y CONTRATOS: DEJAR SIN EFECTO (DSE)
// ============================================================================

export enum ModalidadTramiteDse {
  PREGRADO = 'PREGRADO',
  SEGUNDA_ESPECIALIDAD = 'SEGUNDA_ESPECIALIDAD',
  ERROR_OFICIO = 'ERROR_OFICIO',
}

export enum MotivoAnulacion {
  REINICIAR_TRAMITE = 'REINICIAR_TRAMITE',
  CAMBIO_TEMA = 'CAMBIO_TEMA',
  ERROR_ADMINISTRATIVO = 'ERROR_ADMINISTRATIVO',
  CESE_DOCENTE_ASESOR = 'CESE_DOCENTE_ASESOR',
  ERROR_DIGITACION_TITULO = 'ERROR_DIGITACION_TITULO',
}

export enum TipoActoResolucionDse {
  NOMBRAMIENTO_ASESOR = 'NOMBRAMIENTO_ASESOR',
  NOMBRAMIENTO_COASESOR = 'NOMBRAMIENTO_COASESOR',
  DESIGNACION_DICTAMINANTES_PROYECTO = 'DESIGNACION_DICTAMINANTES_PROYECTO',
  INSCRIPCION_PROYECTO = 'INSCRIPCION_PROYECTO',
  DESIGNACION_DICTAMINANTES_TESIS = 'DESIGNACION_DICTAMINANTES_TESIS',
}

export interface ResolucionAnuladaDto {
  num: string;
  anio: string;
  fechaLiteral: string;
  fecha?: string;
  tipoActo?: TipoActoResolucionDse | string;
  accionResumida?: string;
  detalleExtremoResuelve?: string;
  docenteAsignado?: string;
  docentesDictaminantes?: string[];
  tituloProyecto?: string;
}

export interface DseData extends CommonTemplateData {
  modalidad?: ModalidadTramiteDse;
  esErrorOficio?: boolean;
  numeroTicket?: string;
  fechaCorreoSolicitud?: string;
  tratamientoInteresado?: string;
  nombresInteresados?: string;
  nombreCompleto?: string;
  escuelaProfesional?: string;
  segundaEspecialidadNombre?: string;
  unidadRemitenteError?: string;
  oficioRemitenteError?: string;
  motivoAnulacion?: MotivoAnulacion;
  listaConceptosAnulados?: string;
  resolucionesAnular?: ResolucionAnuladaDto[];
  complementoVisto?: string;
  complementoErrorAdministrativo?: string;
  complementoCeseDocenteAsesor?: string;
  complementoErrorDigitacionTitulo?: string;
  complementoResuelvePrimero?: string;
  disposicionComplementaria?: string;
}

// ============================================================================
// ENUMS Y CONTRATOS: CAMBIO DE DICTAMINANTES (TIPOS A, B y C)
// ============================================================================

export enum ResolucionTipoCambio {
  TIPO_A = 'TIPO_A',
  TIPO_B = 'TIPO_B',
  TIPO_C = 'TIPO_C',
}

export enum VarianteSegundoTipoA {
  ACLARAR = 'ACLARAR',
  PRECISAR = 'PRECISAR',
}

export interface ResolucionAnteriorCambioDto {
  numeroResAnterior: string;
  anioResAnterior: string;
  fechaResAnteriorLiteral: string;
}

export interface ReemplazoDictaminanteDto {
  saliente: string;
  entrante: string;
  motivoTexto?: string;
}

export interface ConcordanciaGramaticalDto {
  a_o: string;
  el_la_los_las: string;
  s: string;
  o_a: string;
  el_la_las_los: string;
  a_o_as_os: string;
}

export interface CambioDictaminanteData extends CommonTemplateData {
  tipoCambio?: ResolucionTipoCambio;
  tratamiento?: string;
  estudianteNombres?: string;
  tesisTitulo?: string;
  numeroResAnterior?: string;
  anioResAnterior?: string;
  fechaResAnteriorLiteral?: string;
  resolucionesAnteriores?: ResolucionAnteriorCambioDto[];
  docentesOriginales?: string;
  docenteSaliente?: string;
  docenteEntrante?: string;
  motivoLiteral?: string;
  reemplazos?: ReemplazoDictaminanteDto[];
  varianteSegundoTipoA?: VarianteSegundoTipoA;
  docenteQuePermanece?: string;
  docenteNuevo?: string;
  tercerDictaminanteDesignado?: string;
  docenteTerceroSaliente?: string;
  docenteTerceroEntrante?: string;
  docentesRatificados?: string[];
  concordancia?: ConcordanciaGramaticalDto;
}

// ============================================================================
// INTERFAZ TRANSVERSAL COMPARTIDA POR LAS 13 ESTRATEGIAS
// ============================================================================

export interface CommonTemplateData {
  codigoExpediente: string;
  escuela: string;
  gradoBachiller: string;
  tituloProfesional: string;
  reglamentoMarco: string;
  departamentoAcademico: string;
  tesistas: TesistaSnapshot[];
  esPlural: boolean;
  articuloBachiller: string;
  articuloBachillerGrado: string;
  listaFormateada: string;
  listaNombresPlanos: string;
  raw: Record<string, any>;
  formatearFechaLargaCastellano: (fechaInput: Date | string) => string;
}