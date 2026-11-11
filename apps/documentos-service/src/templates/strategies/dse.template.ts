// Ruta: apps/documentos-service/src/templates/strategies/dse.template.ts
import {
  DseData,
  ModalidadTramiteDse,
  MotivoAnulacion,
  ResolucionAnuladaDto,
  SeccionesJuridicasResult,
  TipoActoResolucionDse,
} from '../interfaces/template.interface';

const safe = (val?: unknown): string =>
  val !== undefined && val !== null ? String(val).trim() : '';

function construirAccionPorTipoActo(res: ResolucionAnuladaDto): string {
  if (safe(res.accionResumida)) {
    return safe(res.accionResumida);
  }
  const docente = safe(res.docenteAsignado);
  const dicts = Array.isArray(res.docentesDictaminantes)
    ? res.docentesDictaminantes.map((d) => safe(d)).filter(Boolean).join(' y ')
    : '';
  const titulo = safe(res.tituloProyecto);

  switch (res.tipoActo) {
    case TipoActoResolucionDse.NOMBRAMIENTO_ASESOR:
      return `nombra asesor de tesis al **${docente}**`;
    case TipoActoResolucionDse.NOMBRAMIENTO_COASESOR:
      return `nombra co-asesor de tesis al **${docente}**`;
    case TipoActoResolucionDse.DESIGNACION_DICTAMINANTES_PROYECTO:
      return `nombra dictaminantes a **${dicts}**`;
    case TipoActoResolucionDse.INSCRIPCION_PROYECTO:
      return `autoriza la inscripción del Proyecto de Tesis con el título: "${titulo}"`;
    case TipoActoResolucionDse.DESIGNACION_DICTAMINANTES_TESIS:
      return `nombra dictaminantes de tesis a **${dicts}**`;
    default:
      return safe(res.detalleExtremoResuelve);
  }
}

function construirDetalleVistoResoluciones(
  resoluciones: ResolucionAnuladaDto[],
): string {
  if (!resoluciones.length) return '';

  const fragmentos = resoluciones.map((r) => {
    const num = safe(r.num);
    const anio = safe(r.anio);
    const fecha = safe(r.fechaLiteral || r.fecha);
    const accion = construirAccionPorTipoActo(r);
    const sufijoAccion = accion ? ` que ${accion}` : '';
    return `Nº ${num} - ${anio} – FCSa – UAC con fecha ${fecha}${sufijoAccion}`;
  });

  if (fragmentos.length === 1) return fragmentos[0];
  if (fragmentos.length === 2) return `${fragmentos[0]} y ${fragmentos[1]}`;
  return `${fragmentos.slice(0, -1).join(', ')}, y ${fragmentos[fragmentos.length - 1]}`;
}

function buildVistoDse(
  data: DseData,
  resoluciones: ResolucionAnuladaDto[],
): string {
  const fechaCorreoSolicitud = safe(data.fechaCorreoSolicitud);
  const tratamiento = safe(
    data.tratamientoInteresado || data.articuloBachiller,
  );
  const nombresInteresados = safe(
    data.nombresInteresados || data.listaNombresPlanos,
  );
  const escuela = safe(data.escuelaProfesional || data.escuela);
  const numeroTicket = safe(data.numeroTicket);
  const unidadRemitenteError = safe(data.unidadRemitenteError);
  const complementoVisto = safe(data.complementoVisto);
  const detalleRes = construirDetalleVistoResoluciones(resoluciones);
  const etiquetaRes =
    resoluciones.length > 1 ? 'las resoluciones' : 'la resolución';
  const verboSolicitar = data.esPlural
    ? 'quienes solicitan'
    : 'quien solicita';

  if (
    data.modalidad === ModalidadTramiteDse.ERROR_OFICIO ||
    data.esErrorOficio ||
    unidadRemitenteError !== ''
  ) {
    const cola = complementoVisto
      ? ` ${complementoVisto}`
      : detalleRes
        ? `, solicitando dejar sin efecto ${etiquetaRes} ${detalleRes}.`
        : '.';
    return `El correo institucional de fecha ${fechaCorreoSolicitud}, remitido por el ${unidadRemitenteError}${cola}`;
  }

  const colaGeneral = complementoVisto
    ? ` ${complementoVisto}`
    : detalleRes
      ? ` ${etiquetaRes} ${detalleRes}.`
      : ' la resolución(es).';

  if (
    data.modalidad !== ModalidadTramiteDse.SEGUNDA_ESPECIALIDAD &&
    numeroTicket !== ''
  ) {
    return `La solicitud con ticket #${numeroTicket} y vía correo institucional de fecha ${fechaCorreoSolicitud}, presentado por ${tratamiento} **${nombresInteresados}**, de la Escuela Profesional de **${escuela}**, ${verboSolicitar} dejar sin efecto${colaGeneral}`;
  }

  return `La solicitud presentada mediante correo institucional de fecha ${fechaCorreoSolicitud}, presentado por ${tratamiento} **${nombresInteresados}**, de la Escuela Profesional de **${escuela}**, ${verboSolicitar} dejar sin efecto${colaGeneral}`;
}

function buildMotivacionConsiderandoDse(data: DseData): string {
  const nombreCompleto = safe(
    data.nombreCompleto || data.nombresInteresados || data.listaNombresPlanos,
  );
  const listaConceptosAnulados = safe(data.listaConceptosAnulados);
  const oficioRemitenteError = safe(data.oficioRemitenteError);

  switch (data.motivoAnulacion) {
    case MotivoAnulacion.CAMBIO_TEMA:
      return `Que, debido al cambio de tema de investigación, con la finalidad de continuar con el trámite académico correspondiente al nuevo tema de investigación, resulta necesario adoptar las medidas administrativas pertinentes respecto de las resoluciones antes mencionadas, en observancia de los principios de celeridad y eficacia administrativa y de conformidad con la normativa institucional y legal aplicable.`;

    case MotivoAnulacion.ERROR_ADMINISTRATIVO: {
      const comp = safe(data.complementoErrorAdministrativo);
      const sufijo = comp ? ` ${comp}` : '.';
      return `Que, precisando que la emisión del ${oficioRemitenteError} obedeció a un error administrativo, con la finalidad de garantizar la correcta tramitación administrativa de los procedimientos académicos correspondientes a la estudiante antes mencionada, resulta necesario dejar sin efecto, en todos sus extremos${sufijo}`;
    }

    case MotivoAnulacion.CESE_DOCENTE_ASESOR: {
      const comp = safe(data.complementoCeseDocenteAsesor);
      const sufijo = comp
        ? ` ${comp}`
        : `, al amparo de lo establecido por la Ley N°. 27444 Ley del Procedimiento Administrativo General.`;
      return `Que, debido al cese del vínculo laboral del asesor de tesis. Asimismo, solicita que el coasesor de tesis asuma la función de asesor${sufijo}`;
    }

    case MotivoAnulacion.ERROR_DIGITACION_TITULO: {
      const comp = safe(data.complementoErrorDigitacionTitulo);
      const sufijo = comp
        ? ` ${comp}`
        : `, al amparo de lo establecido por la Ley N°. 27444 Ley del Procedimiento Administrativo General.`;
      return `Que, debido a un error de digitación en el registro del título de su proyecto de tesis${sufijo}`;
    }

    case MotivoAnulacion.REINICIAR_TRAMITE:
    default:
      return `Que, mediante el ticket mencionado en el visto, el/la señor(ita) **${nombreCompleto}**, solicita dejar sin efecto la resolución de ${listaConceptosAnulados}, en razón de reiniciar el trámite correspondiente a la modalidad de titulación de presentación y sustentación de tesis y estando a la petición presentado por el/la interesado(a), se hace necesario disponer la respectiva anulación, en aplicación del principio de celeridad y servicio eficiente a los administrados y que, habiéndose realizado el análisis correspondiente, es susceptible efectuar la anulación correspondiente, al amparo de lo establecido por Ley N°. 27444 Ley del Procedimiento Administrativo General.`;
  }
}

function formatListaResolucionesResuelve(
  resoluciones: ResolucionAnuladaDto[],
  escuela: string,
): string {
  if (!resoluciones || resoluciones.length === 0) {
    return '';
  }

  if (resoluciones.length === 1) {
    const r = resoluciones[0];
    const num = safe(r.num);
    const anio = safe(r.anio);
    const fecha = safe(r.fecha || r.fechaLiteral);
    const accion = safe(r.detalleExtremoResuelve) || construirAccionPorTipoActo(r);
    const cola = accion
      ? ` que ${accion}, de la Escuela Profesional de **${escuela}**`
      : `, por los fundamentos expuestos en la parte considerativa de la presente Resolución`;
    return `la **Resolución N.° ${num} - ${anio} - FCSa - UAC**, de fecha ${fecha}${cola}`;
  }

  const items = resoluciones.map((r, index) => {
    const num = safe(r.num);
    const anio = safe(r.anio);
    const fecha = safe(r.fecha || r.fechaLiteral);
    const accion = safe(r.detalleExtremoResuelve) || construirAccionPorTipoActo(r);
    const prefijo = index === 0 ? 'la **resolución Nº' : '**resolución Nº';
    return `${prefijo} ${num} - ${anio} - FCSa - UAC**, de fecha ${fecha}${accion ? ` que ${accion}` : ''}`;
  });

  const sufijoEscuela = escuela
    ? `, de la Escuela Profesional de **${escuela}**`
    : '';

  if (items.length === 2) {
    return `${items[0]} y ${items[1]}${sufijoEscuela}`;
  }

  if (items.length === 3) {
    return `${items[0]}, ${items[1]}, y ${items[2]}${sufijoEscuela}`;
  }

  const primeros = items.slice(0, -1).join(', ');
  const ultimo = items[items.length - 1];
  return `${primeros} y ${ultimo}${sufijoEscuela}`;
}

export function buildDseTemplate(data: DseData): SeccionesJuridicasResult {
  const resoluciones = Array.isArray(data.resolucionesAnular)
    ? data.resolucionesAnular
    : [];
  const escuela = safe(data.escuelaProfesional || data.escuela);

  const visto = buildVistoDse(data, resoluciones);

  const antecedentesN: string[] = resoluciones.map((res) => {
    const num = safe(res.num);
    const anio = safe(res.anio);
    const fechaLiteral = safe(res.fechaLiteral || res.fecha);
    const accionResumida = construirAccionPorTipoActo(res);
    return `Que, mediante la **Resolución Nº ${num} – ${anio} – FCSa – UAC** con fecha ${fechaLiteral}, el Decano de la Facultad de Ciencias de la Salud, ${accionResumida} del(la) señor(ita) mencionado(a) en el visto.`;
  });

  const motivacionM = buildMotivacionConsiderandoDse(data);
  const cierreAtribuciones = `Que, el Decano de la Facultad de Ciencias de la Salud, en uso de las atribuciones conferidas por la Ley 30220 y el Estatuto de la Universidad Andina del Cusco.`;

  const considerando: string[] = [
    ...antecedentesN,
    ...(motivacionM ? [motivacionM] : []),
    cierreAtribuciones,
  ];

  const resolucionesConcatenadas = formatListaResolucionesResuelve(
    resoluciones,
    escuela,
  );
  const complementoPrimero = safe(data.complementoResuelvePrimero);
  const textoPrimero = `**DEJAR SIN EFECTO** en todos sus extremos ${resolucionesConcatenadas}${complementoPrimero ? ` ${complementoPrimero}` : '.'}`;

  const textoSegundo =
    safe(data.disposicionComplementaria) !== ''
      ? safe(data.disposicionComplementaria)
      : `**ENCOMENDAR** a las diferentes dependencias académicas y administrativas de la institución adopten las medidas complementarias para el cumplimiento de la presente Resolución.`;

  return {
    visto,
    considerando,
    articulosResolutivos: [
      {
        titulo: 'PRIMERO.-',
        texto: textoPrimero,
      },
      {
        titulo: 'SEGUNDO.-',
        texto: textoSegundo,
      },
    ],
  };
}