// Ruta: apps/documentos-service/src/templates/strategies/desistimiento.template.ts
import {
  CommonTemplateData,
  SeccionesJuridicasResult,
} from '../interfaces/template.interface';

const safe = (val?: unknown): string =>
  val !== undefined && val !== null ? String(val).trim() : '';

export function buildDesistimientoTemplate(
  data: CommonTemplateData,
): SeccionesJuridicasResult {
  const {
    raw,
    escuela,
    tesistas,
    listaFormateada,
    formatearFechaLargaCastellano,
  } = data;

  const desisteNom = safe(raw.tesistaDesistenteNombresSnapshot).toUpperCase();
  const tesistaContinuaExplicit = safe(
    raw.tesistaContinuaNombresSnapshot || raw.tesistaPermaneceNombresSnapshot,
  ).toUpperCase();

  const tesistaContinuaInferido =
    tesistaContinuaExplicit ||
    tesistas
      .map((t) => safe(t.nombresApellidos).toUpperCase())
      .find((nom) => nom !== '' && nom !== desisteNom) ||
    '';

  const resAsesor = safe(
    raw.resolucionAsesorNumeroSnapshot ||
      raw.resolucionAntecedenteNumeroSnapshot,
  );
  const fechaResAsesorRaw = safe(raw.fechaResolucionAsesorSnapshot);
  const fechaResAsesorTexto = fechaResAsesorRaw
    ? `, de **fecha ${formatearFechaLargaCastellano(fechaResAsesorRaw)},**`
    : ',';

  const resDict = safe(raw.resolucionDictamenNumeroSnapshot);
  const fechaResDictRaw = safe(raw.fechaResolucionDictamenSnapshot);
  const fechaResDictTexto = fechaResDictRaw
    ? `, de fecha ${formatearFechaLargaCastellano(fechaResDictRaw)},`
    : ',';

  const detalleDictamen = resDict
    ? ` **y** por Resolución **Nº ${resDict}${fechaResDictTexto}** el Decano de la Facultad de Ciencias de la Salud designó a los docentes dictaminantes del proyecto de tesis;`
    : '';

  const articulosResolutivos: Array<{ titulo: string; texto: string }> = [
    {
      titulo: 'PRIMERO.-',
      texto: `**APROBAR** el pedido de el/la Señor(ita) **${desisteNom}** de la Escuela Profesional de **${escuela}**, detallado en los considerandos.`,
    },
    {
      titulo: 'SEGUNDO.-',
      texto: `**EXCLUIR,** de todo el trabajo de investigación (tesis) a el/la Señor(ita) **${desisteNom}**.`,
    },
  ];

  if (tesistaContinuaInferido) {
    articulosResolutivos.push({
      titulo: 'TERCERO.-',
      texto: `**PERMANECER,** como único autor del trabajo de investigación (tesis), el/la señor(ita) **${tesistaContinuaInferido}** de la Escuela Profesional de **${escuela}** de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco.`,
    });
    articulosResolutivos.push({
      titulo: 'CUARTO.-',
      texto: `**ENCARGAR,** el cumplimiento de la presente Resolución a las dependencias académicas correspondientes.`,
    });
  } else {
    articulosResolutivos.push({
      titulo: 'TERCERO.-',
      texto: `**ENCARGAR,** el cumplimiento de la presente Resolución a las dependencias académicas correspondientes.`,
    });
  }

  return {
    visto: `La Solicitud S/N de desistimiento, emitida por el/la estudiante Sr(ita) **${desisteNom},** de la Escuela Profesional de **${escuela}** de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco.`,
    considerando: [
      `Que, la Universidad Andina del Cusco, creada por Ley Nº 23837 y autorizado su funcionamiento definitivo por Resolución Nº 195-92-ANR, de conformidad con el Art. 44° de la ley Universitaria Nº 30220, otorga Grados Académicos y Títulos Profesionales a nombre de la Nación, cuya obtención se realiza de acuerdo con las exigencias académicas que establezcan el Reglamento Marco de Grados y Títulos y el Reglamento Específico de la Facultad, previo cumplimiento de los requisitos exigidos al respecto.`,
      `Que, mediante **RESOLUCIÓN Nº ${resAsesor}**${fechaResAsesorTexto} el Decano de la Facultad de Ciencias de la Salud nombra asesor de proyecto de tesis de los(as) Sr(tas) ${listaFormateada}${detalleDictamen} presentado por los(as) Sr(tas) ${listaFormateada}, de la Escuela Profesional de **${escuela}** de la Facultad de Ciencias de la Salud de la Universidad Andina del Cusco.`,
      `Que, se ha recepcionado la Solicitud S/N, de el/la estudiante **${desisteNom},** de la Escuela Profesional de **${escuela}**, mediante la cual cede su participación en el proyecto${tesistaContinuaInferido ? ` a **${tesistaContinuaInferido},** quien continuará con la investigación de manera individual` : ''}.`,
      `Por tanto, el Decano de la Facultad de Ciencias de la Salud, en uso de las atribuciones conferidas por la Ley 30220 y el Estatuto de la Universidad Andina del Cusco.`,
    ],
    articulosResolutivos,
  };
}