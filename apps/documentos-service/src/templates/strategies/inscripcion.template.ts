// Ruta: apps/documentos-service/src/templates/strategies/inscripcion.template.ts
import {
  CommonTemplateData,
  SeccionesJuridicasResult,
} from '../interfaces/template.interface';

const safe = (val?: unknown): string =>
  val !== undefined && val !== null ? String(val).trim() : '';

export function buildInscripcionTemplate(
  data: CommonTemplateData,
): SeccionesJuridicasResult {
  const {
    raw,
    escuela,
    tituloProfesional,
    articuloBachiller,
    listaFormateada,
    esPlural,
    formatearFechaLargaCastellano,
  } = data;

  const titulo = safe(raw.tituloInscritoSnapshot || raw.tituloProyecto);
  const resDict = safe(raw.resolucionDictamenNumeroSnapshot);
  const fechaResDictRaw = safe(
    raw.fechaResolucionDictamenSnapshot || raw.fechaResolucionDictamen,
  );
  const fechaResDictTexto = fechaResDictRaw
    ? `, de fecha ${formatearFechaLargaCastellano(fechaResDictRaw)},`
    : ',';

  const folio = safe(raw.numeroFolioLibroSnapshot || raw.numeroRegistroLibro);
  const fechaRegistroRaw = safe(
    raw.fechaRegistroLibroSnapshot || raw.fechaInscripcionLibro,
  );
  const fechaRegistroTexto = fechaRegistroRaw
    ? `, de fecha ${formatearFechaLargaCastellano(fechaRegistroRaw)}`
    : '';

  const recurrenteTexto = esPlural
    ? 'los recurrentes han formulado'
    : 'el recurrente ha formulado';

  return {
    visto: `La solicitud virtual presentado por ${articuloBachiller} ${listaFormateada}, de la Escuela Profesional de **${escuela}**, solicitando inscripción del Proyecto de Tesis.`,
    considerando: [
      `Que, la Universidad Andina del Cusco, creada por Ley Nº 23837 y autorizado su funcionamiento definitivo por Resolución Nº 195-92-ANR, de conformidad con el Art. 44° de la ley Universitaria Nº 30220, otorga Grados Académicos y Títulos Profesionales a nombre de la Nación, cuya obtención se realiza de acuerdo con las exigencias académicas que establezcan el Reglamento Marco de Grados y Títulos y el Reglamento Específico de la Facultad, previo cumplimiento de los requisitos exigidos al respecto.`,
      `Que, ${recurrenteTexto} el Proyecto de Investigación conducente a la obtención del Título Profesional de **${tituloProfesional},** el mismo que luego de la revisión y pronunciamiento favorable emitido por los docentes dictaminantes designados mediante **RESOLUCIÓN Nº ${resDict}**${fechaResDictTexto} con el siguiente título: "**${titulo}"** y, estando en concordancia con la normativa vigente, corresponde emitir la Resolución de Inscripción y el registro del Proyecto de Tesis en el Libro correspondiente de la Secretaría Académica de la Facultad de Ciencias de la Salud con el **Nº ${folio}${fechaRegistroTexto},** lo cual implica el otorgamiento de derechos de autor sobre dicho tema.`,
      `Que, el Decano de la Facultad de Ciencias de la Salud, en uso de las atribuciones que le confiere la Ley Universitaria vigente y, el Estatuto Universitario.`,
    ],
    articulosResolutivos: [
      {
        titulo: 'PRIMERO.-',
        texto: `**AUTORIZAR LA INSCRIPCIÓN** del Proyecto de Tesis con el título: "**${titulo}",** presentado (a) por ${articuloBachiller} ${listaFormateada}, conducente a la obtención del Título Profesional de **${tituloProfesional}.**`,
      },
      {
        titulo: 'SEGUNDO.-',
        texto: `**ENCOMENDAR** a las Dependencias universitarias competentes, adoptar las acciones complementarias pertinentes para el cumplimiento de los extremos de la presente resolución.`,
      },
    ],
  };
}